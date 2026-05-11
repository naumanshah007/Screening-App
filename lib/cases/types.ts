import type { CaseStatus, ServiceLine, TriagePriority } from "@prisma/client";
import type { OperationalWorkflow } from "@/lib/cases/operational";

export type CaseSlaBucket =
  | "OVERDUE"
  | "DUE_SOON"
  | "BOOKED"
  | "ON_TRACK"
  | "NO_TARGET";

export type ColposcopyTriageFields = {
  fctStatus?: string;
  hpvTestResult?: string;
  hpvType?: string;
  cytologySample?: string;
  referrerReasonCode?: string;
  assessmentOfReferral?: string;
  bookingPriorityNote?: string;
  referralType?: string;
  ovestinInstruction?: string;
  ncsrNoteAdded?: boolean;
  referralNoteAdded?: boolean;
  internalTriageNotes?: string;
};

export type GynaecologyTriageFields = {
  gynaecologyCategory?: string;
  ussAvailable?: boolean;
  ussFindings?: string;
};

export type CreateReferralCaseInput = {
  patientId: string;
  serviceLine: ServiceLine;
  receivedAt?: Date;
  referralSource?: string;
  externalCaseId?: string;
  referralReason?: string;
  currentPriority?: TriagePriority;
  currentCategory?: string;
  assignedToUserId?: string;
  highSuspicionCancer?: boolean;
  smoOnly?: boolean;
  regradeOfCaseId?: string;
  triageNotes?: string;
} & ColposcopyTriageFields &
  GynaecologyTriageFields;

export type UpdateReferralCaseInput = {
  receivedAt?: Date;
  referralSource?: string | null;
  externalCaseId?: string | null;
  referralReason?: string | null;
  currentCategory?: string | null;
  assignedToUserId?: string | null;
  highSuspicionCancer?: boolean;
  smoOnly?: boolean;
  regradeOfCaseId?: string | null;
  triageNotes?: string | null;
  fctStatus?: string | null;
  hpvTestResult?: string | null;
  hpvType?: string | null;
  cytologySample?: string | null;
  referrerReasonCode?: string | null;
  assessmentOfReferral?: string | null;
  bookingPriorityNote?: string | null;
  referralType?: string | null;
  ovestinInstruction?: string | null;
  ncsrNoteAdded?: boolean;
  referralNoteAdded?: boolean;
  internalTriageNotes?: string | null;
  gynaecologyCategory?: string | null;
  ussAvailable?: boolean;
  ussFindings?: string | null;
};

export type ListReferralCasesFilters = {
  serviceLine?: ServiceLine;
  status?: CaseStatus;
  currentPriority?: TriagePriority;
  workflow?: OperationalWorkflow;
  slaBucket?: CaseSlaBucket;
  assignedToUserId?: string;
  requiresSmoReview?: boolean;
  search?: string;
  page?: number;
  limit?: number;
};
