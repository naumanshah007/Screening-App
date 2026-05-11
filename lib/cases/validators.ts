import type {
  CreateReferralCaseInput,
  ListReferralCasesFilters,
  UpdateReferralCaseInput,
} from "./types";

const SERVICE_LINES = ["COLPOSCOPY", "GYNAECOLOGY"] as const;
const CASE_STATUSES = [
  "NEW",
  "INGESTING",
  "READY_FOR_SUMMARY",
  "READY_FOR_GRADING",
  "NEEDS_MORE_INFO",
  "GRADED",
  "REJECTED",
  "RETURNED_TO_GP",
  "BOOKED",
  "CLOSED",
] as const;
const TRIAGE_PRIORITIES = [
  "P1",
  "P1_HSC",
  "P2",
  "P2_HSC",
  "P3",
  "P5",
  "REJECT",
  "DECLINE",
  "INFO_REQUIRED",
] as const;
const SLA_BUCKETS = [
  "OVERDUE",
  "DUE_SOON",
  "BOOKED",
  "ON_TRACK",
  "NO_TARGET",
] as const;
const OPERATIONAL_WORKFLOWS = [
  "PENDING_REVIEW",
  "BOOKABLE",
  "VIRTUAL_CLINIC",
  "RETURN_TO_GP",
  "NEEDS_MORE_INFO",
] as const;

function parseBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLowerCase();
  if (["true", "1", "yes", "on"].includes(normalized)) return true;
  if (["false", "0", "no", "off"].includes(normalized)) return false;
  return undefined;
}

function parseDate(value: unknown): Date | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return value;
  if (typeof value !== "string") return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function normalizeOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeNullableString(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function isServiceLine(value: unknown): value is (typeof SERVICE_LINES)[number] {
  return typeof value === "string" && SERVICE_LINES.includes(value as (typeof SERVICE_LINES)[number]);
}

function isCaseStatus(value: unknown): value is (typeof CASE_STATUSES)[number] {
  return typeof value === "string" && CASE_STATUSES.includes(value as (typeof CASE_STATUSES)[number]);
}

function isTriagePriority(value: unknown): value is (typeof TRIAGE_PRIORITIES)[number] {
  return typeof value === "string" && TRIAGE_PRIORITIES.includes(value as (typeof TRIAGE_PRIORITIES)[number]);
}

function isSlaBucket(value: unknown): value is (typeof SLA_BUCKETS)[number] {
  return typeof value === "string" && SLA_BUCKETS.includes(value as (typeof SLA_BUCKETS)[number]);
}

function isOperationalWorkflow(
  value: unknown
): value is (typeof OPERATIONAL_WORKFLOWS)[number] {
  return (
    typeof value === "string" &&
    OPERATIONAL_WORKFLOWS.includes(
      value as (typeof OPERATIONAL_WORKFLOWS)[number]
    )
  );
}

export function validateCreateReferralCaseInput(body: unknown):
  | { success: true; data: CreateReferralCaseInput }
  | { success: false; error: string } {
  if (!body || typeof body !== "object") {
    return { success: false, error: "Request body must be a JSON object" };
  }

  const input = body as Record<string, unknown>;
  const patientId = normalizeOptionalString(input.patientId);
  if (!patientId) {
    return { success: false, error: "patientId is required" };
  }

  if (!isServiceLine(input.serviceLine)) {
    return { success: false, error: "serviceLine must be COLPOSCOPY or GYNAECOLOGY" };
  }

  const receivedAt = parseDate(input.receivedAt);
  if (input.receivedAt && !receivedAt) {
    return { success: false, error: "receivedAt must be a valid ISO date" };
  }

  if (input.currentPriority && !isTriagePriority(input.currentPriority)) {
    return { success: false, error: "currentPriority is invalid" };
  }

  return {
    success: true,
    data: {
      patientId,
      serviceLine: input.serviceLine,
      receivedAt,
      referralSource: normalizeOptionalString(input.referralSource),
      externalCaseId: normalizeOptionalString(input.externalCaseId),
      referralReason: normalizeOptionalString(input.referralReason),
      currentPriority: isTriagePriority(input.currentPriority) ? input.currentPriority : undefined,
      currentCategory: normalizeOptionalString(input.currentCategory),
      assignedToUserId: normalizeOptionalString(input.assignedToUserId),
      highSuspicionCancer: parseBoolean(input.highSuspicionCancer),
      smoOnly: parseBoolean(input.smoOnly),
      regradeOfCaseId: normalizeOptionalString(input.regradeOfCaseId),
      triageNotes: normalizeOptionalString(input.triageNotes),
      // Colposcopy-specific fields
      fctStatus: normalizeOptionalString(input.fctStatus),
      hpvTestResult: normalizeOptionalString(input.hpvTestResult),
      hpvType: normalizeOptionalString(input.hpvType),
      cytologySample: normalizeOptionalString(input.cytologySample),
      referrerReasonCode: normalizeOptionalString(input.referrerReasonCode),
      assessmentOfReferral: normalizeOptionalString(input.assessmentOfReferral),
      bookingPriorityNote: normalizeOptionalString(input.bookingPriorityNote),
      referralType: normalizeOptionalString(input.referralType),
      ovestinInstruction: normalizeOptionalString(input.ovestinInstruction),
      ncsrNoteAdded: parseBoolean(input.ncsrNoteAdded),
      referralNoteAdded: parseBoolean(input.referralNoteAdded),
      internalTriageNotes: normalizeOptionalString(input.internalTriageNotes),
      // Gynaecology-specific fields
      gynaecologyCategory: normalizeOptionalString(input.gynaecologyCategory),
      ussAvailable: parseBoolean(input.ussAvailable),
      ussFindings: normalizeOptionalString(input.ussFindings),
    },
  };
}

export function validateUpdateReferralCaseInput(body: unknown):
  | { success: true; data: UpdateReferralCaseInput }
  | { success: false; error: string } {
  if (!body || typeof body !== "object") {
    return { success: false, error: "Request body must be a JSON object" };
  }

  const input = body as Record<string, unknown>;
  const receivedAt = parseDate(input.receivedAt);
  if (input.receivedAt !== undefined && !receivedAt) {
    return { success: false, error: "receivedAt must be a valid ISO date" };
  }

  const highSuspicionCancer = parseBoolean(input.highSuspicionCancer);
  if (input.highSuspicionCancer !== undefined && highSuspicionCancer === undefined) {
    return { success: false, error: "highSuspicionCancer must be true or false" };
  }

  const smoOnly = parseBoolean(input.smoOnly);
  if (input.smoOnly !== undefined && smoOnly === undefined) {
    return { success: false, error: "smoOnly must be true or false" };
  }

  return {
    success: true,
    data: {
      receivedAt,
      referralSource: normalizeNullableString(input.referralSource),
      externalCaseId: normalizeNullableString(input.externalCaseId),
      referralReason: normalizeNullableString(input.referralReason),
      currentCategory: normalizeNullableString(input.currentCategory),
      assignedToUserId: normalizeNullableString(input.assignedToUserId),
      highSuspicionCancer,
      smoOnly,
      regradeOfCaseId: normalizeNullableString(input.regradeOfCaseId),
      triageNotes: normalizeNullableString(input.triageNotes),
      // Colposcopy-specific fields
      fctStatus: normalizeNullableString(input.fctStatus),
      hpvTestResult: normalizeNullableString(input.hpvTestResult),
      hpvType: normalizeNullableString(input.hpvType),
      cytologySample: normalizeNullableString(input.cytologySample),
      referrerReasonCode: normalizeNullableString(input.referrerReasonCode),
      assessmentOfReferral: normalizeNullableString(input.assessmentOfReferral),
      bookingPriorityNote: normalizeNullableString(input.bookingPriorityNote),
      referralType: normalizeNullableString(input.referralType),
      ovestinInstruction: normalizeNullableString(input.ovestinInstruction),
      ncsrNoteAdded: parseBoolean(input.ncsrNoteAdded),
      referralNoteAdded: parseBoolean(input.referralNoteAdded),
      internalTriageNotes: normalizeNullableString(input.internalTriageNotes),
      // Gynaecology-specific fields
      gynaecologyCategory: normalizeNullableString(input.gynaecologyCategory),
      ussAvailable: parseBoolean(input.ussAvailable),
      ussFindings: normalizeNullableString(input.ussFindings),
    },
  };
}

export function parseReferralCaseFilters(url: URL):
  | { success: true; data: ListReferralCasesFilters }
  | { success: false; error: string } {
  const { searchParams } = url;
  const serviceLine = searchParams.get("serviceLine");
  const status = searchParams.get("status");
  const currentPriority = searchParams.get("priority");
  const workflow = searchParams.get("workflow");
  const slaBucket = searchParams.get("slaBucket");
  const smoOnly = searchParams.get("smoOnly");
  const page = Number.parseInt(searchParams.get("page") ?? "1", 10);
  const limit = Number.parseInt(searchParams.get("limit") ?? "20", 10);

  if (serviceLine && !isServiceLine(serviceLine)) {
    return { success: false, error: "serviceLine filter is invalid" };
  }
  if (status && !isCaseStatus(status)) {
    return { success: false, error: "status filter is invalid" };
  }
  if (currentPriority && !isTriagePriority(currentPriority)) {
    return { success: false, error: "priority filter is invalid" };
  }
  if (workflow && !isOperationalWorkflow(workflow)) {
    return { success: false, error: "workflow filter is invalid" };
  }
  if (slaBucket && !isSlaBucket(slaBucket)) {
    return { success: false, error: "slaBucket filter is invalid" };
  }
  const normalizedSmoOnly =
    smoOnly === null ? undefined : parseBoolean(smoOnly);
  if (smoOnly !== null && normalizedSmoOnly === undefined) {
    return { success: false, error: "smoOnly filter must be true or false" };
  }
  if (!Number.isFinite(page) || page < 1) {
    return { success: false, error: "page must be a positive integer" };
  }
  if (!Number.isFinite(limit) || limit < 1 || limit > 100) {
    return { success: false, error: "limit must be between 1 and 100" };
  }

  const normalizedServiceLine = isServiceLine(serviceLine) ? serviceLine : undefined;
  const normalizedStatus = isCaseStatus(status) ? status : undefined;
  const normalizedPriority = isTriagePriority(currentPriority)
    ? currentPriority
    : undefined;
  const normalizedWorkflow = isOperationalWorkflow(workflow)
    ? workflow
    : undefined;
  const normalizedSlaBucket = isSlaBucket(slaBucket) ? slaBucket : undefined;

  return {
    success: true,
    data: {
      serviceLine: normalizedServiceLine,
      status: normalizedStatus,
      currentPriority: normalizedPriority,
      workflow: normalizedWorkflow,
      slaBucket: normalizedSlaBucket,
      assignedToUserId: normalizeOptionalString(searchParams.get("assignedToUserId")),
      requiresSmoReview: normalizedSmoOnly,
      search: normalizeOptionalString(searchParams.get("search")),
      page,
      limit,
    },
  };
}
