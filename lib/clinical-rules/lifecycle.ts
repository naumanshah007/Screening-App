import type {
  ClinicalRuleChangeClassification,
  Prisma,
  RuleActivationEnvironment,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";

import { calculateRuleSnapshotChecksum, deterministicJson } from "./checksum";
import { NATIONAL_RULE_SET_KEY } from "./constants";
import { ClinicalRuleSnapshotSchema, parseSnapshot, type ClinicalRuleSnapshot } from "./schema";
import { validateClinicalRuleSnapshot } from "./validation";

export type AuditMetadata = {
  ipAddress?: string | null;
  userAgent?: string | null;
};

const versionInclude = {
  ruleSet: true,
  parentVersion: {
    select: { id: true, displayVersion: true, status: true },
  },
  createdBy: { select: { id: true, name: true, email: true } },
  approvedBy: { select: { id: true, name: true, email: true } },
  publishedBy: { select: { id: true, name: true, email: true } },
  activations: {
    include: { activatedBy: { select: { id: true, name: true, email: true } } },
    orderBy: { activatedAt: "desc" as const },
  },
  _count: { select: { evaluations: true, childVersions: true } },
} satisfies Prisma.ClinicalRuleVersionInclude;

export type ClinicalRuleVersionRecord = Prisma.ClinicalRuleVersionGetPayload<{
  include: typeof versionInclude;
}>;

function ensureDraftEditable(status: string) {
  if (status !== "DRAFT" && status !== "VALIDATED") {
    throw new Error("Only draft or validated-but-unpublished versions may be edited.");
  }
}

function parseSemanticVersion(displayVersion: string) {
  const match = /^(?:CG-NCSP-)?(\d+)\.(\d+)\.(\d+)$/.exec(displayVersion.trim());
  if (!match) {
    throw new Error("Version must use semantic form CG-NCSP-MAJOR.MINOR.PATCH.");
  }
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    displayVersion: `CG-NCSP-${match[1]}.${match[2]}.${match[3]}`,
  };
}

async function createVersionAudit(
  tx: Prisma.TransactionClient,
  args: {
    ruleSetId: string;
    ruleVersionId?: string;
    actorUserId?: string;
    eventType: string;
    reason?: string;
    before?: unknown;
    after?: unknown;
    metadata?: AuditMetadata;
  }
) {
  await tx.ruleVersionAuditEvent.create({
    data: {
      ruleSetId: args.ruleSetId,
      ruleVersionId: args.ruleVersionId,
      actorUserId: args.actorUserId,
      eventType: args.eventType,
      reason: args.reason,
      beforeJson: args.before === undefined ? undefined : JSON.stringify(args.before),
      afterJson: args.after === undefined ? undefined : JSON.stringify(args.after),
      ipAddress: args.metadata?.ipAddress,
      userAgent: args.metadata?.userAgent,
    },
  });
  await tx.auditLog.create({
    data: {
      userId: args.actorUserId,
      action: args.eventType,
      entity: "ClinicalRuleVersion",
      entityId: args.ruleVersionId,
      oldValue: args.before === undefined ? undefined : JSON.stringify(args.before),
      newValue: args.after === undefined ? undefined : JSON.stringify(args.after),
      ipAddress: args.metadata?.ipAddress,
      userAgent: args.metadata?.userAgent,
    },
  });
}

export async function listClinicalRuleVersions() {
  return prisma.clinicalRuleVersion.findMany({
    include: versionInclude,
    orderBy: [{ versionMajor: "desc" }, { versionMinor: "desc" }, { versionPatch: "desc" }],
  });
}

export async function getClinicalRuleVersion(id: string) {
  return prisma.clinicalRuleVersion.findUnique({ where: { id }, include: versionInclude });
}

export async function getClinicalRuleVersionSnapshot(id: string) {
  const version = await getClinicalRuleVersion(id);
  if (!version) throw new Error("Clinical rule version not found.");
  return { version, snapshot: parseSnapshot(JSON.parse(version.snapshotJson)) };
}

export async function cloneClinicalRuleVersion(args: {
  sourceVersionId: string;
  displayVersion: string;
  changeSummary: string;
  changeClassification: ClinicalRuleChangeClassification;
  actorUserId: string;
  metadata?: AuditMetadata;
}) {
  const semantic = parseSemanticVersion(args.displayVersion);
  const source = await prisma.clinicalRuleVersion.findUnique({
    where: { id: args.sourceVersionId },
    include: { ruleSet: true },
  });
  if (!source) throw new Error("Source clinical rule version not found.");
  if (!["PUBLISHED", "ACTIVE", "RETIRED", "ARCHIVED"].includes(source.status)) {
    throw new Error("Create a governed draft by cloning a published or previously published version.");
  }
  if (!args.changeSummary.trim()) throw new Error("A change summary is required.");

  const snapshot = parseSnapshot(JSON.parse(source.snapshotJson));
  snapshot.productRuleSet.displayVersion = semantic.displayVersion;
  snapshot.productRuleSet.name = `CerviGrade NCSP Rule Set v${semantic.major}.${semantic.minor}.${semantic.patch}`;
  const snapshotJson = deterministicJson(snapshot);
  const checksum = calculateRuleSnapshotChecksum(snapshot);

  return prisma.$transaction(async (tx) => {
    const created = await tx.clinicalRuleVersion.create({
      data: {
        ruleSetId: source.ruleSetId,
        versionMajor: semantic.major,
        versionMinor: semantic.minor,
        versionPatch: semantic.patch,
        displayVersion: semantic.displayVersion,
        status: "DRAFT",
        parentVersionId: source.id,
        sourcePackageVersion: source.sourcePackageVersion,
        sourceGuidelineSummary: source.sourceGuidelineSummary,
        snapshotJson,
        checksum,
        revision: 1,
        changeSummary: args.changeSummary.trim(),
        changeClassification: args.changeClassification,
        createdById: args.actorUserId,
      },
      include: versionInclude,
    });
    await createVersionAudit(tx, {
      ruleSetId: source.ruleSetId,
      ruleVersionId: created.id,
      actorUserId: args.actorUserId,
      eventType: "CLONE",
      reason: args.changeSummary,
      before: { sourceVersionId: source.id, displayVersion: source.displayVersion },
      after: { displayVersion: created.displayVersion, checksum, revision: 1 },
      metadata: args.metadata,
    });
    return created;
  });
}

export async function updateClinicalRuleDraft(args: {
  id: string;
  expectedRevision: number;
  snapshot: unknown;
  changeSummary?: string;
  actorUserId: string;
  checkpoint?: boolean;
  metadata?: AuditMetadata;
}) {
  const snapshot = ClinicalRuleSnapshotSchema.parse(args.snapshot);
  const snapshotJson = deterministicJson(snapshot);
  const checksum = calculateRuleSnapshotChecksum(snapshot);

  return prisma.$transaction(async (tx) => {
    const current = await tx.clinicalRuleVersion.findUnique({ where: { id: args.id } });
    if (!current) throw new Error("Clinical rule version not found.");
    ensureDraftEditable(current.status);
    if (current.revision !== args.expectedRevision) {
      throw new Error(
        `Draft revision conflict: expected ${args.expectedRevision}, current revision is ${current.revision}. Reload before saving.`
      );
    }
    if (snapshot.productRuleSet.displayVersion !== current.displayVersion) {
      throw new Error("Snapshot version identity cannot be changed by draft editing.");
    }
    if (current.parentVersionId) {
      const parent = await tx.clinicalRuleVersion.findUnique({
        where: { id: current.parentVersionId },
        select: { status: true, snapshotJson: true },
      });
      if (parent && ["PUBLISHED", "ACTIVE", "RETIRED", "ARCHIVED"].includes(parent.status)) {
        const parentSnapshot = parseSnapshot(JSON.parse(parent.snapshotJson));
        const nextRuleIds = new Set(snapshot.rules.map((rule) => rule.stableRuleId));
        const deletedRuleIds = parentSnapshot.rules
          .map((rule) => rule.stableRuleId)
          .filter((ruleId) => !nextRuleIds.has(ruleId));
        if (deletedRuleIds.length > 0) {
          throw new Error(
            `Rules referenced by a published parent cannot be deleted: ${deletedRuleIds.join(", ")}. Retain and explicitly retire or supersede them instead.`
          );
        }
      }
    }

    const updated = await tx.clinicalRuleVersion.update({
      where: { id: current.id },
      data: {
        snapshotJson,
        checksum,
        revision: { increment: 1 },
        status: "DRAFT",
        validationJson: null,
        validatedAt: null,
        approvedById: null,
        changeSummary: args.changeSummary?.trim() || current.changeSummary,
      },
      include: versionInclude,
    });
    await createVersionAudit(tx, {
      ruleSetId: current.ruleSetId,
      ruleVersionId: current.id,
      actorUserId: args.actorUserId,
      eventType: args.checkpoint ? "DRAFT_CHECKPOINT" : "DRAFT_AUTOSAVE",
      reason: args.changeSummary,
      before: { revision: current.revision, checksum: current.checksum },
      after: { revision: updated.revision, checksum },
      metadata: args.metadata,
    });
    return updated;
  });
}

export async function validateClinicalRuleVersion(args: {
  id: string;
  actorUserId: string;
  metadata?: AuditMetadata;
}) {
  const current = await prisma.clinicalRuleVersion.findUnique({ where: { id: args.id } });
  if (!current) throw new Error("Clinical rule version not found.");
  ensureDraftEditable(current.status);

  await prisma.clinicalRuleVersion.update({
    where: { id: current.id },
    data: { status: "VALIDATING" },
  });

  const report = validateClinicalRuleSnapshot(JSON.parse(current.snapshotJson));
  const status = report.valid ? "VALIDATED" : "DRAFT";
  const version = await prisma.$transaction(async (tx) => {
    const updated = await tx.clinicalRuleVersion.update({
      where: { id: current.id },
      data: {
        status,
        validationJson: JSON.stringify(report),
        validatedAt: report.valid ? new Date() : null,
        approvedById: null,
      },
      include: versionInclude,
    });
    await createVersionAudit(tx, {
      ruleSetId: current.ruleSetId,
      ruleVersionId: current.id,
      actorUserId: args.actorUserId,
      eventType: report.valid ? "VALIDATION_PASSED" : "VALIDATION_FAILED",
      after: { valid: report.valid, counts: report.counts },
      metadata: args.metadata,
    });
    return updated;
  });
  return { version, report };
}

export async function approveClinicalRuleVersion(args: {
  id: string;
  actorUserId: string;
  reason: string;
  metadata?: AuditMetadata;
}) {
  if (!args.reason.trim()) throw new Error("An approval reason is required.");
  return prisma.$transaction(async (tx) => {
    const current = await tx.clinicalRuleVersion.findUnique({ where: { id: args.id } });
    if (!current) throw new Error("Clinical rule version not found.");
    if (current.status !== "VALIDATED") throw new Error("Only a validated version can be approved.");
    if (current.createdById && current.createdById === args.actorUserId) {
      throw new Error("The draft creator cannot approve the same version.");
    }
    const updated = await tx.clinicalRuleVersion.update({
      where: { id: current.id },
      data: { approvedById: args.actorUserId },
      include: versionInclude,
    });
    await createVersionAudit(tx, {
      ruleSetId: current.ruleSetId,
      ruleVersionId: current.id,
      actorUserId: args.actorUserId,
      eventType: "APPROVAL",
      reason: args.reason,
      after: { approvedById: args.actorUserId },
      metadata: args.metadata,
    });
    return updated;
  });
}

export async function publishClinicalRuleVersion(args: {
  id: string;
  actorUserId: string;
  reason: string;
  sourceSummary: string;
  metadata?: AuditMetadata;
}) {
  if (!args.reason.trim()) throw new Error("A publication reason is required.");
  if (!args.sourceSummary.trim()) throw new Error("A clinical source summary is required.");
  return prisma.$transaction(async (tx) => {
    const current = await tx.clinicalRuleVersion.findUnique({ where: { id: args.id } });
    if (!current) throw new Error("Clinical rule version not found.");
    if (current.status !== "VALIDATED") throw new Error("Only a validated version can be published.");
    if (!current.approvedById) throw new Error("Clinical approval is required before publication.");
    const report = current.validationJson ? JSON.parse(current.validationJson) : null;
    if (!report?.valid) throw new Error("A passing validation report is required before publication.");
    const snapshot = parseSnapshot(JSON.parse(current.snapshotJson));
    const checksum = calculateRuleSnapshotChecksum(snapshot);
    if (current.checksum !== checksum) throw new Error("Snapshot checksum mismatch; validate the draft again.");

    const updated = await tx.clinicalRuleVersion.update({
      where: { id: current.id },
      data: {
        status: "PUBLISHED",
        sourceGuidelineSummary: args.sourceSummary.trim(),
        checksum,
        publishedById: args.actorUserId,
        publishedAt: new Date(),
      },
      include: versionInclude,
    });
    await createVersionAudit(tx, {
      ruleSetId: current.ruleSetId,
      ruleVersionId: current.id,
      actorUserId: args.actorUserId,
      eventType: "PUBLICATION",
      reason: args.reason,
      before: { status: current.status },
      after: { status: updated.status, checksum, sourceSummary: args.sourceSummary },
      metadata: args.metadata,
    });
    return updated;
  });
}

const activeVersionCache = new Map<string, { expiresAt: number; versionId: string }>();

export function invalidateClinicalRuleVersionCache(ruleSetId?: string) {
  if (!ruleSetId) activeVersionCache.clear();
  else {
    for (const key of activeVersionCache.keys()) {
      if (key.startsWith(`${ruleSetId}:`)) activeVersionCache.delete(key);
    }
  }
}

export async function activateClinicalRuleVersion(args: {
  id: string;
  actorUserId: string;
  environment: RuleActivationEnvironment;
  organisationKey?: string | null;
  reason: string;
  rollback?: boolean;
  metadata?: AuditMetadata;
}) {
  if (!args.reason.trim()) throw new Error("An activation or rollback reason is required.");
  if (args.environment === "PRODUCTION") {
    throw new Error("This proof-of-concept may not activate a production ruleset environment.");
  }

  const result = await prisma.$transaction(async (tx) => {
    const target = await tx.clinicalRuleVersion.findUnique({ where: { id: args.id } });
    if (!target) throw new Error("Clinical rule version not found.");
    if (!["PUBLISHED", "ACTIVE"].includes(target.status)) {
      throw new Error("Only a published version can be activated.");
    }
    if (!target.checksum) throw new Error("A published checksum is required before activation.");

    const previous = await tx.ruleSetActivation.findFirst({
      where: {
        ruleSetId: target.ruleSetId,
        organisationKey: args.organisationKey ?? null,
        environment: args.environment,
        isDefault: true,
        deactivatedAt: null,
      },
      orderBy: { activatedAt: "desc" },
    });
    if (previous?.ruleVersionId === target.id) {
      return { target, previous, activation: previous, unchanged: true };
    }

    const activatedAt = new Date();
    if (previous) {
      await tx.ruleSetActivation.update({
        where: { id: previous.id },
        data: { deactivatedAt: activatedAt },
      });
      const otherActive = await tx.ruleSetActivation.count({
        where: { ruleVersionId: previous.ruleVersionId, deactivatedAt: null },
      });
      if (otherActive === 0) {
        await tx.clinicalRuleVersion.update({
          where: { id: previous.ruleVersionId },
          data: { status: "PUBLISHED" },
        });
      }
      await createVersionAudit(tx, {
        ruleSetId: target.ruleSetId,
        ruleVersionId: previous.ruleVersionId,
        actorUserId: args.actorUserId,
        eventType: "DEACTIVATION",
        reason: args.reason,
        after: { environment: args.environment, organisationKey: args.organisationKey ?? null },
        metadata: args.metadata,
      });
    }

    const activation = await tx.ruleSetActivation.create({
      data: {
        ruleSetId: target.ruleSetId,
        ruleVersionId: target.id,
        organisationKey: args.organisationKey,
        environment: args.environment,
        isDefault: true,
        activatedById: args.actorUserId,
        activatedAt,
        reason: args.reason.trim(),
      },
    });
    const updated = await tx.clinicalRuleVersion.update({
      where: { id: target.id },
      data: { status: "ACTIVE", activatedAt },
    });
    await createVersionAudit(tx, {
      ruleSetId: target.ruleSetId,
      ruleVersionId: target.id,
      actorUserId: args.actorUserId,
      eventType: args.rollback ? "ROLLBACK" : "ACTIVATION",
      reason: args.reason,
      before: previous
        ? { ruleVersionId: previous.ruleVersionId, activationId: previous.id }
        : undefined,
      after: {
        ruleVersionId: target.id,
        activationId: activation.id,
        environment: args.environment,
        organisationKey: args.organisationKey ?? null,
      },
      metadata: args.metadata,
    });
    return { target: updated, previous, activation, unchanged: false };
  });

  invalidateClinicalRuleVersionCache(result.target.ruleSetId);
  return result;
}

export async function resolveActiveClinicalRuleVersion(args: {
  environment?: RuleActivationEnvironment;
  organisationKey?: string | null;
  ruleSetKey?: string;
}) {
  const environment = args.environment ?? "DEMO";
  const ruleSet = await prisma.clinicalRuleSet.findUnique({
    where: { key: args.ruleSetKey ?? NATIONAL_RULE_SET_KEY },
  });
  if (!ruleSet) return null;
  const cacheKey = `${ruleSet.id}:${args.organisationKey ?? "GLOBAL"}:${environment}`;
  const cached = activeVersionCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return getClinicalRuleVersion(cached.versionId);
  }

  const activation = await prisma.ruleSetActivation.findFirst({
    where: {
      ruleSetId: ruleSet.id,
      organisationKey: args.organisationKey ?? null,
      environment,
      isDefault: true,
      deactivatedAt: null,
    },
    orderBy: { activatedAt: "desc" },
  });
  if (!activation && args.organisationKey) {
    return resolveActiveClinicalRuleVersion({
      environment,
      organisationKey: null,
      ruleSetKey: args.ruleSetKey,
    });
  }
  if (!activation) return null;
  activeVersionCache.set(cacheKey, {
    versionId: activation.ruleVersionId,
    expiresAt: Date.now() + 30_000,
  });
  return getClinicalRuleVersion(activation.ruleVersionId);
}

export async function resolveShadowClinicalRuleVersion() {
  const active = await resolveActiveClinicalRuleVersion({ environment: "DEMO" });
  if (active) return active;
  return prisma.clinicalRuleVersion.findFirst({
    where: { ruleSet: { key: NATIONAL_RULE_SET_KEY } },
    include: versionInclude,
    orderBy: [
      { versionMajor: "desc" },
      { versionMinor: "desc" },
      { versionPatch: "desc" },
      { updatedAt: "desc" },
    ],
  });
}

export async function retireClinicalRuleVersion(args: {
  id: string;
  actorUserId: string;
  reason: string;
  archive?: boolean;
  metadata?: AuditMetadata;
}) {
  if (!args.reason.trim()) throw new Error("A retirement/archive reason is required.");
  return prisma.$transaction(async (tx) => {
    const current = await tx.clinicalRuleVersion.findUnique({
      where: { id: args.id },
      include: { activations: { where: { deactivatedAt: null } } },
    });
    if (!current) throw new Error("Clinical rule version not found.");
    if (current.activations.length > 0) throw new Error("Deactivate the version before retirement.");
    if (args.archive && current.status !== "RETIRED") {
      throw new Error("Only a retired version can be archived.");
    }
    if (!args.archive && current.status !== "PUBLISHED") {
      throw new Error("Only a published inactive version can be retired.");
    }
    const status = args.archive ? "ARCHIVED" : "RETIRED";
    const updated = await tx.clinicalRuleVersion.update({
      where: { id: current.id },
      data: { status, retiredAt: args.archive ? current.retiredAt : new Date() },
      include: versionInclude,
    });
    await createVersionAudit(tx, {
      ruleSetId: current.ruleSetId,
      ruleVersionId: current.id,
      actorUserId: args.actorUserId,
      eventType: args.archive ? "ARCHIVE" : "RETIREMENT",
      reason: args.reason,
      before: { status: current.status },
      after: { status },
      metadata: args.metadata,
    });
    return updated;
  });
}

export function summariseSnapshot(snapshot: ClinicalRuleSnapshot) {
  return {
    rules: snapshot.rules.length,
    nodes: snapshot.nodes.length,
    edges: snapshot.edges.length,
    views: snapshot.views.length,
    sourcePackageVersion: snapshot.sourcePackage.version,
  };
}
