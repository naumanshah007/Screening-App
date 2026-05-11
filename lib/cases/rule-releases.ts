import { Prisma, type ServiceLine } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  formatCaseRuleReleaseDefinitionJson,
  getBaselineCaseRuleReleaseDefinition,
  validateCaseRuleReleaseDefinitionJson,
} from "@/lib/cases/rule-policy";
import { runCaseRuleRegression } from "@/lib/cases/rule-regression";

const caseRuleSetReleaseInclude = {
  reviewedBy: {
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  },
  publishedBy: {
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  },
} satisfies Prisma.CaseRuleSetReleaseInclude;

export type CaseRuleSetReleaseRecord = Prisma.CaseRuleSetReleaseGetPayload<{
  include: typeof caseRuleSetReleaseInclude;
}>;

type BaselineRulePack = {
  version: string;
  name: string;
  description: string;
  changeNotes: string;
  definition: {
    releaseKind: string;
    serviceLine: ServiceLine;
    sourceOfTruth: string[];
    notes: string[];
    defaultRecommendation: {
      priority: string;
      category: string;
      outcome: string;
      rationale: string;
    };
    rules: Array<{
      code: string;
      title: string;
      impact: string;
      kind: string;
    }>;
  };
};

const BASELINE_RULE_RELEASES: Record<ServiceLine, BaselineRulePack> = {
  COLPOSCOPY: {
    version: "2026.03.21.1",
    name: "Colposcopy Enterprise Baseline",
    description:
      "Initial enterprise rule release wrapping the deterministic colposcopy triage logic in a publishable release.",
    changeNotes:
      "Seeds the enterprise colposcopy rules under release control before full attachment-level parity work.",
    definition: {
      ...getBaselineCaseRuleReleaseDefinition("COLPOSCOPY"),
    },
  },
  GYNAECOLOGY: {
    version: "2026.03.21.1",
    name: "Gynaecology Enterprise Baseline",
    description:
      "Initial enterprise rule release wrapping the deterministic gynaecology triage logic in a publishable release.",
    changeNotes:
      "Seeds the enterprise gynaecology rules under release control before full guideline matrix parity work.",
    definition: {
      ...getBaselineCaseRuleReleaseDefinition("GYNAECOLOGY"),
    },
  },
};

function serviceLabel(serviceLine: ServiceLine) {
  return serviceLine === "COLPOSCOPY" ? "Colposcopy" : "Gynaecology";
}

function makeVersion(serviceLine: ServiceLine, existingCount: number) {
  const now = new Date();
  const y = `${now.getFullYear()}`;
  const m = `${now.getMonth() + 1}`.padStart(2, "0");
  const d = `${now.getDate()}`.padStart(2, "0");
  const suffix = existingCount + 1;
  const prefix = serviceLine === "COLPOSCOPY" ? "colpo" : "gyn";
  return `${y}.${m}.${d}.${prefix}.${suffix}`;
}

export async function ensureBaselineCaseRuleSetReleases() {
  for (const serviceLine of ["COLPOSCOPY", "GYNAECOLOGY"] as const) {
    const baseline = BASELINE_RULE_RELEASES[serviceLine];
    const existing = await prisma.caseRuleSetRelease.findUnique({
      where: {
        serviceLine_version: {
          serviceLine,
          version: baseline.version,
        },
      },
      select: { id: true, isActive: true },
    });

    if (!existing) {
      await prisma.caseRuleSetRelease.create({
        data: {
          serviceLine,
          version: baseline.version,
          name: baseline.name,
          description: baseline.description,
          schemaVersion: "2.0",
          definitionJson: JSON.stringify(baseline.definition),
          changeNotes: baseline.changeNotes,
          isActive: true,
        },
      });
      continue;
    }

    await prisma.caseRuleSetRelease.update({
      where: { id: existing.id },
      data: {
        name: baseline.name,
        description: baseline.description,
        schemaVersion: "2.0",
        definitionJson: JSON.stringify(baseline.definition),
        changeNotes: baseline.changeNotes,
      },
    });

    const activeForService = await prisma.caseRuleSetRelease.count({
      where: {
        serviceLine,
        isActive: true,
      },
    });

    if (activeForService === 0) {
      await prisma.caseRuleSetRelease.update({
        where: { id: existing.id },
        data: {
          isActive: true,
        },
      });
    }
  }
}

export async function listCaseRuleSetReleases() {
  await ensureBaselineCaseRuleSetReleases();
  return prisma.caseRuleSetRelease.findMany({
    include: caseRuleSetReleaseInclude,
    orderBy: [
      { serviceLine: "asc" },
      { isActive: "desc" },
      { createdAt: "desc" },
    ],
  });
}

export async function getActiveCaseRuleSetRelease(serviceLine: ServiceLine) {
  await ensureBaselineCaseRuleSetReleases();
  return prisma.caseRuleSetRelease.findFirst({
    where: {
      serviceLine,
      isActive: true,
    },
    include: caseRuleSetReleaseInclude,
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
  });
}

export async function getCaseRuleSetReleaseById(id: string) {
  await ensureBaselineCaseRuleSetReleases();
  return prisma.caseRuleSetRelease.findUnique({
    where: { id },
    include: caseRuleSetReleaseInclude,
  });
}

export async function createCaseRuleSetDraft(args: {
  serviceLine: ServiceLine;
  actorUserId: string;
}) {
  await ensureBaselineCaseRuleSetReleases();

  const [latest, count] = await Promise.all([
    prisma.caseRuleSetRelease.findFirst({
      where: { serviceLine: args.serviceLine },
      orderBy: [{ createdAt: "desc" }],
    }),
    prisma.caseRuleSetRelease.count({
      where: { serviceLine: args.serviceLine },
    }),
  ]);

  const version = makeVersion(args.serviceLine, count);
  const created = await prisma.caseRuleSetRelease.create({
    data: {
      serviceLine: args.serviceLine,
      version,
      name: `${serviceLabel(args.serviceLine)} Draft ${version}`,
      description:
        latest?.description ??
        `Draft enterprise ${serviceLabel(args.serviceLine).toLowerCase()} release`,
      schemaVersion: latest?.schemaVersion ?? "2.0",
      definitionJson:
        latest?.definitionJson ??
        JSON.stringify(BASELINE_RULE_RELEASES[args.serviceLine].definition),
      changeNotes: `Draft cloned from ${latest?.version ?? "baseline"}. Update notes before review/publish.`,
      isActive: false,
    },
    include: caseRuleSetReleaseInclude,
  });

  await prisma.auditLog.create({
    data: {
      userId: args.actorUserId,
      action: "CREATE",
      entity: "CaseRuleSetRelease",
      entityId: created.id,
      newValue: JSON.stringify({
        serviceLine: created.serviceLine,
        version: created.version,
        sourceVersion: latest?.version ?? null,
      }),
    },
  });

  return created;
}

function normaliseOptionalText(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function updateCaseRuleSetReleaseDraft(args: {
  id: string;
  actorUserId: string;
  name: string;
  description: string;
  changeNotes: string;
  definitionJson: string;
}) {
  const release = await prisma.caseRuleSetRelease.findUnique({
    where: { id: args.id },
    include: caseRuleSetReleaseInclude,
  });

  if (!release) {
    throw new Error("Case rule release not found");
  }

  if (release.isActive) {
    throw new Error("Active case rule releases are immutable");
  }

  if (release.publishedAt) {
    throw new Error("Published case rule releases are immutable; create a draft instead");
  }

  const name = args.name.trim();
  if (name.length === 0) {
    throw new Error("name is required");
  }

  const definition = validateCaseRuleReleaseDefinitionJson({
    serviceLine: release.serviceLine,
    definitionJson: args.definitionJson,
  });

  const updated = await prisma.caseRuleSetRelease.update({
    where: { id: release.id },
    data: {
      name,
      description: normaliseOptionalText(args.description),
      changeNotes: normaliseOptionalText(args.changeNotes),
      schemaVersion: "2.0",
      definitionJson: formatCaseRuleReleaseDefinitionJson(definition),
      reviewedByUserId: null,
      reviewedAt: null,
    },
    include: caseRuleSetReleaseInclude,
  });

  await prisma.auditLog.create({
    data: {
      userId: args.actorUserId,
      action: "UPDATE",
      entity: "CaseRuleSetRelease",
      entityId: updated.id,
      oldValue: JSON.stringify({
        name: release.name,
        description: release.description,
        changeNotes: release.changeNotes,
        reviewedByUserId: release.reviewedByUserId,
        reviewedAt: release.reviewedAt,
        definitionJson: release.definitionJson,
      }),
      newValue: JSON.stringify({
        name: updated.name,
        description: updated.description,
        changeNotes: updated.changeNotes,
        reviewedByUserId: updated.reviewedByUserId,
        reviewedAt: updated.reviewedAt,
        definitionJson: updated.definitionJson,
      }),
    },
  });

  return updated;
}

export async function reviewCaseRuleSetRelease(args: {
  id: string;
  actorUserId: string;
}) {
  const release = await prisma.caseRuleSetRelease.findUnique({
    where: { id: args.id },
  });

  if (!release) {
    throw new Error("Case rule release not found");
  }

  const reviewed = await prisma.caseRuleSetRelease.update({
    where: { id: args.id },
    data: {
      reviewedByUserId: args.actorUserId,
      reviewedAt: new Date(),
    },
    include: caseRuleSetReleaseInclude,
  });

  await prisma.auditLog.create({
    data: {
      userId: args.actorUserId,
      action: "REVIEW",
      entity: "CaseRuleSetRelease",
      entityId: reviewed.id,
      newValue: JSON.stringify({
        serviceLine: reviewed.serviceLine,
        version: reviewed.version,
        reviewedByUserId: reviewed.reviewedByUserId,
        reviewedAt: reviewed.reviewedAt,
      }),
    },
  });

  return reviewed;
}

export async function publishCaseRuleSetRelease(args: {
  id: string;
  actorUserId: string;
}) {
  const release = await prisma.caseRuleSetRelease.findUnique({
    where: { id: args.id },
  });

  if (!release) {
    throw new Error("Case rule release not found");
  }

  if (!release.reviewedByUserId || !release.reviewedAt) {
    throw new Error("Case rule release must be reviewed before publishing");
  }

  if (release.reviewedByUserId === args.actorUserId) {
    throw new Error("Reviewer and publisher must be different users");
  }

  const regression = runCaseRuleRegression({
    serviceLine: release.serviceLine,
    definitionJson: release.definitionJson,
  });
  if (regression.failed > 0) {
    throw new Error("Case rule release regression suite must pass before publishing");
  }

  const published = await prisma.$transaction(async (tx) => {
    await tx.caseRuleSetRelease.updateMany({
      where: {
        serviceLine: release.serviceLine,
      },
      data: {
        isActive: false,
      },
    });

    return tx.caseRuleSetRelease.update({
      where: { id: release.id },
      data: {
        isActive: true,
        publishedByUserId: args.actorUserId,
        publishedAt: new Date(),
      },
      include: caseRuleSetReleaseInclude,
    });
  });

  await prisma.auditLog.create({
    data: {
      userId: args.actorUserId,
      action: "PUBLISH",
      entity: "CaseRuleSetRelease",
      entityId: published.id,
      newValue: JSON.stringify({
        serviceLine: published.serviceLine,
        version: published.version,
        publishedByUserId: published.publishedByUserId,
        publishedAt: published.publishedAt,
        regressionPassed: regression.passed,
        regressionTotal: regression.total,
      }),
    },
  });

  return published;
}
