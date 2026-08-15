# Customer-facing terminology sweep

This record classifies the flagged vocabulary found in user-visible render paths during the final terminology cleanup. It is technical evidence, not customer-facing application copy.

## REMOVE / RENAME

| Surface | Previous wording | Customer wording |
| --- | --- | --- |
| Integration Centre header | Phase / secure live connectivity | Connection testing / secure and bounded |
| Integration summary | Ready for live test | Ready to test |
| Integration summary | Live verified | Recently verified |
| Integration summary | Paused / errors | Needs attention |
| Integration health | Readiness health | Integration health |
| Connection cards and history | Live connectivity / live test | Connection test |
| Connection cards and history | Activation / Not active | Data ingestion / Not enabled |
| Environment selector and cards | Production-like | Pilot |
| FHIR connector schedule guidance | Phase 3B live test | Connection test |
| Stored validation connector display | Phase 3B SSRF Policy QA | Outbound Security Validation |
| Stored validation connector display | Phase 3B Controlled FHIR… | FHIR R4 Test Connection |
| Stored demo connector display | Awanui Labs — Phase 3A Demo | Awanui Labs — Demo HL7 |
| Sidebar | Legacy Referral Queue | Referral Queue |
| Command Centre ruleset card | Legacy Engine / Legacy router / Canonical shadow | Current grading rules / current clinical router / ruleset evaluation |
| Sidebar authority indicator | shadow/simulation only | evaluation only |
| Pathway, GP and patient headings | Legacy tool(s) | Clinical pathway tool / clinical records |
| Analytics summary | Legacy disagreements / safety floor | Ruleset disagreements / current grading safety floor |
| Intake-session header | Legacy engine / versioned shadow | Previous grading rules / versioned evaluation |

The normal Integration Centre now keeps security and development validation instances in a collapsed, administrator-only **Test & validation connections** section. Configuration, append-only connection history and audit evidence remain accessible.

## TECHNICAL DETAILS ONLY

The following terms remain only where they describe real persisted or historical technical facts:

- `SHADOW` when it is the actual evaluation mode in decision provenance, comparison evidence, governance or Rule Studio.
- `LEGACY` when it is the actual authority-engine value, a historical decision pin, rollback target or pathway-router provenance.
- `Canonical V2` in the detailed governed-evaluation comparison component and canonical fact provenance.
- `SSRF` in security-control implementation, tests, audit evidence and historical engineering documentation.
- `QA`, phase, sprint and C0 identifiers in tests, migrations, scripts and historical delivery/deployment evidence.
- `PRODUCTION_LIKE` as the pre-existing stored connector metadata value. The data model and audit record are unchanged; every customer-rendered environment value is formatted as **Pilot**.

## CUSTOMER-APPROPRIATE

- **Demo**, **Test**, **Pilot** and **Production** are the approved environment vocabulary. The Integration Centre offers Demo, Test and Pilot because it has no Production connector configuration path.
- **Production** remains on explicit production-governance and activation surfaces where it describes real production authority, not a connection test or simulated environment.
- **Previous grading rules**, **current grading rules**, **parallel evaluation** and **ruleset evaluation** are used on normal clinical screens without changing which rules are authoritative.

## Evidence preservation

No connection, connectivity check, audit event, internal identifier, environment metadata or historical document was deleted or rewritten by this cleanup. Internal connector names are transformed only at the presentation boundary; audit details remain available, with environment values formatted to the controlled customer vocabulary.
