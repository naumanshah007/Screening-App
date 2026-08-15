# C0 external gate readiness register

Date: 15 August 2026

No gate is approved. Classifications describe only the evidence available after the synthetic C0 rehearsal.

| # | External gate | Classification | Evidence available | Missing decision/evidence |
| --- | --- | --- | --- | --- |
| 1 | Customer privacy impact assessment and privacy approval | READY FOR CUSTOMER DECISION | architecture boundary, data-minimisation, logging, audit, retention/export decision points | customer privacy owner, PIA outcome, approved conditions |
| 2 | New Zealand data-residency and hosting approval | BLOCKED BY EXTERNAL PARTY | remote authenticated database requirement proven locally | named provider/region, contractual residency evidence, customer approval |
| 3 | Customer security and operator approval | EVIDENCE PREPARED | MFA/session/RBAC/audit/incident/deployment/restore evidence and procedures | customer security review, named operators, accepted configuration values |
| 4 | Clinical governance approval for pilot operating protocol | READY FOR CUSTOMER DECISION | human-review, simulated export, SHADOW/authority, and no-mutation boundaries documented | approved scope, protocol, clinical owners, stop/rollback criteria |
| 5 | Canonical `16 / 2 / 11` interpretation/approval/activation gates | PARTIALLY PREPARED | baseline recovered and preserved; C0 made no clinical change | two distinct human approvals, all activation gates, explicit activation authority |
| 6 | Dedicated pilot infrastructure, DNS, network and access protection | BLOCKED BY EXTERNAL PARTY | reproducible authenticated loopback environment only | hosted isolated resources, DNS, firewall/access policy, monitoring and credentials |
| 7 | Hospital SSO/IdP and MFA evidence if selected | BLOCKED BY EXTERNAL PARTY | local password+TOTP MFA path verified; SSO mode fails closed | IdP choice/config, claims/role mapping, MFA/break-glass evidence, customer acceptance |
| 8 | Managed backup schedule, retention, provider restore, RPO/RTO | PARTIALLY PREPARED | isolated loss/restore, integrity, protected evidence, and application read PASS | provider credentials/schedule, immutable backup id, hosted restore, accepted RPO/RTO |
| 9 | External immutable/WORM audit anchoring | BLOCKED BY EXTERNAL PARTY | database tamper-resistance and integrity evidence | selected WORM/evidence service, retention/access controls, anchoring proof |
| 10 | Retention, deletion and legal-hold policy | READY FOR CUSTOMER DECISION | runtime policy-reference gate and no-wipe/deletion runbook | approved durations, record classes, legal hold, deletion/disposal authority |
| 11 | Real-data processing authority and named pilot cohort | BLOCKED BY EXTERNAL PARTY | synthetic-only scope and real-data stop line documented | data-sharing/processing authority, data controller, named service/cohort and users |
| 12 | Secure export, DLP, recipients, transfer and disposal | READY FOR CUSTOMER DECISION | human-only simulated package and audited export boundaries verified | permitted formats/recipients, DLP, secure channel, recipient validation, disposal |
| 13 | Production/staging migration and deployment approval | PARTIALLY PREPARED | Prisma root cause resolved; Sprint A-to-B local and authenticated remote-style deployment PASS | dedicated target, secrets/change record, rollback window, operator and formal approval |

## Stop line

Hosted pilot creation, real PHI, customer UAT, canonical activation, production deployment, and production database changes remain prohibited until the applicable gates have actual external evidence and approval.
