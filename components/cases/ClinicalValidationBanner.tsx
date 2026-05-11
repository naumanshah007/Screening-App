import { Alert } from "@/components/ui/alert";

export function ClinicalValidationBanner() {
  return (
    <Alert variant="info" title="Workflow MVP">
      Rules are under clinical validation. Recommendations are provisional and
      require clinician confirmation before any patient-facing action.
    </Alert>
  );
}
