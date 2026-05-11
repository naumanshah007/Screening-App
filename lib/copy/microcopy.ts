export const EMPTY_STATES = {
  cases:        { title: "No cases found",        description: "No cases match your current filters. Try adjusting or clearing them.",    eyebrow: "Cases" },
  casesAll:     { title: "No cases yet",           description: "Cases will appear here once referrals have been submitted.",              eyebrow: "Cases" },
  patients:     { title: "No patients found",      description: "Search by name or NHI to find a patient record.",                        eyebrow: "Patients" },
  guidelines:   { title: "No guidelines available", description: "Guidelines will appear here when configured by your administrator.",    eyebrow: "Guidelines" },
  auditLog:     { title: "No audit events",        description: "Events will appear here as users interact with the system.",             eyebrow: "Audit" },
  rules:        { title: "No rules configured",   description: "Create your first rule to automate triage decisions.",                    eyebrow: "Rules" },
  documents:    { title: "No documents",           description: "Upload referral documents and evidence files to begin triage.",           eyebrow: "Documents" },
  analytics:    { title: "No data available",     description: "Analytics will populate once cases have been processed.",                  eyebrow: "Analytics" },
  focusActions: { title: "All clear",             description: "No actions require your attention right now.",                              eyebrow: "Focus" },
} as const;

export const CONFIRM = {
  deleteDocument:  { title: "Delete document?",  description: "This document will be permanently removed and cannot be recovered.", confirmLabel: "Delete document" },
  deletePatient:   { title: "Delete patient?",   description: "Deleting this patient will remove all associated records. This cannot be undone.", confirmLabel: "Delete patient" },
  rejectReferral:  { title: "Reject referral?",  description: "This referral will be marked as rejected and returned to the referring GP.", confirmLabel: "Reject referral", variant: "danger" as const },
  closeCase:       { title: "Close this case?",  description: "Closing the case will archive it. You can reopen it if needed.", confirmLabel: "Close case", variant: "primary" as const },
  signOut:         { title: "Sign out?",          description: "You will be signed out of the current session.", confirmLabel: "Sign out" },
} as const;

export const TOAST = {
  saved:         "Changes saved",
  caseCreated:   "Case created successfully",
  caseUpdated:   "Case updated",
  deleted:       "Deleted successfully",
  copied:        "Copied to clipboard",
  exportStarted: "Export started — your download will begin shortly",
  syncStarted:   "Sync in progress…",
  syncDone:      "Sync complete",
  errorGeneric:  "Something went wrong. Please try again.",
  errorSave:     "Failed to save. Please check your connection and try again.",
  errorNetwork:  "Network error. Please check your connection.",
} as const;

export const STATUS_LABELS: Record<string, string> = {
  PENDING:              "Pending",
  APPROVED:             "Approved",
  COMPLETE:             "Complete",
  COMPLETED:            "Completed",
  REJECTED:             "Rejected",
  IN_PROGRESS:          "In Progress",
  RECALLED:             "Recalled",
  REFERRED:             "Referred",
  AWAITING_APPOINTMENT: "Awaiting Appointment",
  ESCALATED:            "Escalated",
  NEW:                  "New",
  INGESTING:            "Processing",
  READY_FOR_SUMMARY:    "Ready for Summary",
  READY_FOR_GRADING:    "Ready for Grading",
  NEEDS_MORE_INFO:      "More Info Required",
  GRADED:               "Graded",
  RETURNED_TO_GP:       "Returned to GP",
  BOOKED:               "Booked",
  CLOSED:               "Closed",
};

export const SLA_LEGEND: Record<string, { label: string; description: string }> = {
  OVERDUE:   { label: "Overdue",   description: "Past the target booking date" },
  DUE_SOON:  { label: "Due soon",  description: "Appointment due within 2 weeks" },
  ON_TRACK:  { label: "On track",  description: "Within the priority time target" },
};

export const INTEGRATION_STATUS: Record<string, string> = {
  connected:    "Connected and syncing",
  disconnected: "Not connected — check your configuration",
  error:        "Connection error — contact your administrator",
  pending:      "Connecting…",
  degraded:     "Partial connectivity — some features may be unavailable",
};

export const PRIORITY_DESCRIPTIONS: Record<string, { label: string; days: string; description: string }> = {
  P1:           { label: "P1 — Urgent",       days: "≤20 working days", description: "Requires urgent assessment and booking within 20 working days." },
  P1_HSC:       { label: "P1 — HSC Urgent",   days: "",                 description: "High Suspicion of Cancer — immediate escalation required." },
  P2:           { label: "P2 — High",         days: "≤42 working days", description: "Requires high-priority booking within 42 working days." },
  P2_HSC:       { label: "P2 — HSC High",     days: "",                 description: "High Suspicion of Cancer (semi-urgent)." },
  P3:           { label: "P3 — Standard",     days: "≤84 working days", description: "Routine booking within 84 working days." },
  P4:           { label: "P4 — Routine",      days: "≤168 working days", description: "Non-urgent booking within 168 working days." },
  P5:           { label: "P5 — Virtual",      days: "",                 description: "Managed via virtual clinic — no in-person appointment required." },
  REJECT:       { label: "Reject",            days: "",                 description: "Referral does not meet criteria and is returned to the referrer." },
  DECLINE:      { label: "Decline",           days: "",                 description: "Declined — outside service scope." },
  INFO_REQUIRED: { label: "Info Required",    days: "",                 description: "More information needed before a priority can be assigned." },
};
