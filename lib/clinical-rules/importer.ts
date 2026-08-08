import { prisma } from "@/lib/prisma";

import { calculateRuleSnapshotChecksum, deterministicJson } from "./checksum";
import {
  IMPORTED_PRODUCT_VERSION,
  IMPORTED_PRODUCT_VERSION_PARTS,
  NATIONAL_RULE_SET_KEY,
} from "./constants";
import { ClinicalRuleSnapshotSchema } from "./schema";
import { resolveImportSnapshot } from "./import-source";
import {
  buildSuccessorSnapshotFromV21Package,
  SUCCESSOR_PRODUCT_VERSION,
  SUCCESSOR_PRODUCT_VERSION_PARTS,
} from "./successor-v3-1";
import {
  buildSnapshotFromV21Package,
  type SourcePackageVerification,
} from "./source-package";
import { validateClinicalRuleSnapshot, type RuleValidationReport } from "./validation";

export type RulebookImportResult = {
  action: "CREATED" | "UPDATED" | "UNCHANGED";
  ruleSetId: string;
  ruleVersionId: string;
  displayVersion: string;
  checksum: string;
  revision: number;
  status: string;
  verification: SourcePackageVerification;
  validation: RuleValidationReport;
};

export async function importNcspRulebookV21(args: {
  sourceDirectory?: string;
  actorUserId?: string;
} = {}): Promise<RulebookImportResult> {
  const built = await resolveImportSnapshot({
    name: "cg-ncsp-3.0.0",
    explicitSourceDirectory: args.sourceDirectory,
    buildFromSource: () => buildSnapshotFromV21Package(args.sourceDirectory),
  });
  const snapshot = ClinicalRuleSnapshotSchema.parse(built.snapshot);
  const checksum = calculateRuleSnapshotChecksum(snapshot);
  const snapshotJson = deterministicJson(snapshot);
  const validation = validateClinicalRuleSnapshot(snapshot);

  return prisma.$transaction(async (tx) => {
    const ruleSet = await tx.clinicalRuleSet.upsert({
      where: { key: NATIONAL_RULE_SET_KEY },
      update: {
        name: "CerviGrade NCSP National Clinical Rules",
        description:
          "Source-derived national cervical-screening decision graph. Provisional recommendation; reviewer confirmation required; not for direct clinical action.",
      },
      create: {
        key: NATIONAL_RULE_SET_KEY,
        name: "CerviGrade NCSP National Clinical Rules",
        description:
          "Source-derived national cervical-screening decision graph. Provisional recommendation; reviewer confirmation required; not for direct clinical action.",
        scope: "GLOBAL",
      },
    });

    const existing = await tx.clinicalRuleVersion.findUnique({
      where: {
        ruleSetId_displayVersion: {
          ruleSetId: ruleSet.id,
          displayVersion: IMPORTED_PRODUCT_VERSION,
        },
      },
    });

    if (existing) {
      if (existing.checksum !== checksum || existing.snapshotJson !== snapshotJson) {
        const existingSnapshot = JSON.parse(existing.snapshotJson) as {
          sourcePackage?: { sourceJsonSha256?: string };
        };
        const evaluationCount = await tx.ruleEvaluation.count({
          where: { ruleVersionId: existing.id },
        });
        if (
          existing.status !== "DRAFT" ||
          existing.revision !== 1 ||
          evaluationCount !== 0 ||
          existingSnapshot.sourcePackage?.sourceJsonSha256 !== snapshot.sourcePackage.sourceJsonSha256
        ) {
          throw new Error(
            `${IMPORTED_PRODUCT_VERSION} already exists with different content. Create a new semantic version; never overwrite an edited, evaluated, or published version identity.`
          );
        }
        const refreshed = await tx.clinicalRuleVersion.update({
          where: { id: existing.id },
          data: {
            snapshotJson,
            checksum,
            revision: { increment: 1 },
            validationJson: JSON.stringify(validation),
          },
        });
        await tx.ruleVersionAuditEvent.create({
          data: {
            ruleSetId: ruleSet.id,
            ruleVersionId: existing.id,
            actorUserId: args.actorUserId,
            eventType: "IMPORT_REFRESH",
            reason: "Refreshed untouched draft projection from the same verified source JSON",
            beforeJson: JSON.stringify({ checksum: existing.checksum, revision: existing.revision }),
            afterJson: JSON.stringify({ checksum, revision: refreshed.revision }),
          },
        });
        return {
          action: "UPDATED" as const,
          ruleSetId: ruleSet.id,
          ruleVersionId: refreshed.id,
          displayVersion: refreshed.displayVersion,
          checksum,
          revision: refreshed.revision,
          status: refreshed.status,
          verification: built.verification,
          validation,
        };
      }
      return {
        action: "UNCHANGED" as const,
        ruleSetId: ruleSet.id,
        ruleVersionId: existing.id,
        displayVersion: existing.displayVersion,
        checksum,
        revision: existing.revision,
        status: existing.status,
        verification: built.verification,
        validation,
      };
    }

    const version = await tx.clinicalRuleVersion.create({
      data: {
        ruleSetId: ruleSet.id,
        versionMajor: IMPORTED_PRODUCT_VERSION_PARTS.major,
        versionMinor: IMPORTED_PRODUCT_VERSION_PARTS.minor,
        versionPatch: IMPORTED_PRODUCT_VERSION_PARTS.patch,
        displayVersion: IMPORTED_PRODUCT_VERSION,
        status: "DRAFT",
        sourcePackageVersion: snapshot.sourcePackage.version,
        sourceGuidelineSummary:
          "NCSP June 2023 final v1.1, February 2026 addendum, and March 2026 immune-deficiency guidance v1.0.1; prior extraction used only as a secondary cross-check.",
        snapshotJson,
        checksum,
        revision: 1,
        changeSummary:
          "Initial canonical import of all 203 v2.1 source-derived rule records and 12 synchronized graph views.",
        changeClassification: "CLINICAL_LOGIC",
        validationJson: JSON.stringify(validation),
        createdById: args.actorUserId,
      },
    });

    await tx.ruleVersionAuditEvent.create({
      data: {
        ruleSetId: ruleSet.id,
        ruleVersionId: version.id,
        actorUserId: args.actorUserId,
        eventType: "IMPORT",
        reason: "Idempotent import of the verified v2.1 source package",
        afterJson: JSON.stringify({
          displayVersion: version.displayVersion,
          checksum,
          sourcePackageVersion: snapshot.sourcePackage.version,
          ruleCount: snapshot.rules.length,
          nodeCount: snapshot.nodes.length,
          edgeCount: snapshot.edges.length,
          viewCount: snapshot.views.length,
          validationPassed: validation.valid,
        }),
      },
    });
    await tx.auditLog.create({
      data: {
        userId: args.actorUserId,
        action: "IMPORT",
        entity: "ClinicalRuleVersion",
        entityId: version.id,
        newValue: JSON.stringify({
          ruleSetId: ruleSet.id,
          displayVersion: version.displayVersion,
          checksum,
          sourcePackageVersion: snapshot.sourcePackage.version,
        }),
      },
    });

    return {
      action: "CREATED" as const,
      ruleSetId: ruleSet.id,
      ruleVersionId: version.id,
      displayVersion: version.displayVersion,
      checksum,
      revision: version.revision,
      status: version.status,
      verification: built.verification,
      validation,
    };
  });
}

export async function importNcspRulebookV21Successor(args: {
  sourceDirectory?: string;
  actorUserId?: string;
  reason?: string;
} = {}): Promise<RulebookImportResult> {
  const built = await resolveImportSnapshot({
    name: "cg-ncsp-3.1.0",
    explicitSourceDirectory: args.sourceDirectory,
    buildFromSource: () => buildSuccessorSnapshotFromV21Package(args.sourceDirectory),
  });
  const snapshot = ClinicalRuleSnapshotSchema.parse(built.snapshot);
  const checksum = calculateRuleSnapshotChecksum(snapshot);
  const snapshotJson = deterministicJson(snapshot);
  const validation = validateClinicalRuleSnapshot(snapshot);
  const reason =
    args.reason?.trim() ||
    "Create protected release-hardening successor with canonical facts v2, source-supported metadata closure, and explicit ambiguity dispositions.";

  return prisma.$transaction(async (tx) => {
    const ruleSet = await tx.clinicalRuleSet.findUnique({
      where: { key: NATIONAL_RULE_SET_KEY },
    });
    if (!ruleSet) {
      throw new Error(
        "Import the protected CG-NCSP-3.0.0 parent before creating its successor."
      );
    }
    const parent = await tx.clinicalRuleVersion.findUnique({
      where: {
        ruleSetId_displayVersion: {
          ruleSetId: ruleSet.id,
          displayVersion: IMPORTED_PRODUCT_VERSION,
        },
      },
    });
    if (!parent) {
      throw new Error("The protected CG-NCSP-3.0.0 parent version was not found.");
    }

    const existing = await tx.clinicalRuleVersion.findUnique({
      where: {
        ruleSetId_displayVersion: {
          ruleSetId: ruleSet.id,
          displayVersion: SUCCESSOR_PRODUCT_VERSION,
        },
      },
    });
    if (existing) {
      if (
        existing.checksum !== checksum ||
        existing.snapshotJson !== snapshotJson ||
        existing.parentVersionId !== parent.id
      ) {
        throw new Error(
          `${SUCCESSOR_PRODUCT_VERSION} already exists with different content or parentage. Create another semantic version; never overwrite a governed successor identity.`
        );
      }
      return {
        action: "UNCHANGED" as const,
        ruleSetId: ruleSet.id,
        ruleVersionId: existing.id,
        displayVersion: existing.displayVersion,
        checksum,
        revision: existing.revision,
        status: existing.status,
        verification: built.verification,
        validation,
      };
    }

    const version = await tx.clinicalRuleVersion.create({
      data: {
        ruleSetId: ruleSet.id,
        versionMajor: SUCCESSOR_PRODUCT_VERSION_PARTS.major,
        versionMinor: SUCCESSOR_PRODUCT_VERSION_PARTS.minor,
        versionPatch: SUCCESSOR_PRODUCT_VERSION_PARTS.patch,
        displayVersion: SUCCESSOR_PRODUCT_VERSION,
        status: "DRAFT",
        parentVersionId: parent.id,
        sourcePackageVersion: snapshot.sourcePackage.version,
        sourceGuidelineSummary:
          "NCSP June 2023 final v1.1 with February 2026 addendum and March 2026 immune-deficiency guidance v1.0.1; primary-source ambiguity review and canonical facts v2 engineering evidence attached; governed clinical review remains required.",
        snapshotJson,
        checksum,
        revision: 1,
        changeSummary: reason,
        changeClassification: "CLINICAL_LOGIC",
        validationJson: JSON.stringify({
          ...validation,
          releaseSubStatus:
            "ENGINEERING_VALIDATION_PASSED_CLINICAL_GOVERNANCE_PENDING",
          publicationPermitted: false,
        }),
        createdById: args.actorUserId,
      },
    });
    await tx.ruleVersionAuditEvent.create({
      data: {
        ruleSetId: ruleSet.id,
        ruleVersionId: version.id,
        actorUserId: args.actorUserId,
        eventType: "SUCCESSOR_CREATED",
        reason,
        beforeJson: JSON.stringify({
          parentVersionId: parent.id,
          parentDisplayVersion: parent.displayVersion,
          parentChecksum: parent.checksum,
          parentRevision: parent.revision,
        }),
        afterJson: JSON.stringify({
          displayVersion: version.displayVersion,
          checksum,
          status: version.status,
          sourcePackageVersion: snapshot.sourcePackage.version,
          schemaVersion: snapshot.schemaVersion,
          engineContractVersion: snapshot.engineContractVersion,
          ruleCount: snapshot.rules.length,
          nodeCount: snapshot.nodes.length,
          edgeCount: snapshot.edges.length,
          viewCount: snapshot.views.length,
          validationPassed: validation.valid,
          publicationPermitted: false,
        }),
      },
    });
    await tx.auditLog.create({
      data: {
        userId: args.actorUserId,
        action: "SUCCESSOR_CREATED",
        entity: "ClinicalRuleVersion",
        entityId: version.id,
        oldValue: JSON.stringify({ parentVersionId: parent.id }),
        newValue: JSON.stringify({
          displayVersion: version.displayVersion,
          checksum,
          parentVersionId: parent.id,
          status: "DRAFT",
        }),
      },
    });

    return {
      action: "CREATED" as const,
      ruleSetId: ruleSet.id,
      ruleVersionId: version.id,
      displayVersion: version.displayVersion,
      checksum,
      revision: version.revision,
      status: version.status,
      verification: built.verification,
      validation,
    };
  });
}
