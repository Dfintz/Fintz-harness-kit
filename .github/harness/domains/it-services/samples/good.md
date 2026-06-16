# Statement of Work — Acme Corp Managed Kubernetes Platform

## Scope

This engagement delivers a managed Kubernetes platform for Acme Corp's payments team and the runbook
to operate it.

In scope:

- Provisioning of one production and one staging EKS cluster in `eu-west-1`.
- CI/CD pipeline integration for the two payments services named in Appendix A.
- 24x7 monitoring and on-call response per the SLA below.

Out of scope:

- Application code changes inside the payments services themselves.
- Database administration of the existing RDS instances (remains with Acme's DBA team).
- Any region outside `eu-west-1`.

## Architecture

Two isolated EKS clusters (staging, production) per environment, each with private node groups behind
a network load balancer. Ingress is terminated at an ALB with WAF enabled. Observability is via a
managed Prometheus/Grafana stack; logs ship to CloudWatch with a 90-day retention. Infrastructure is
defined in Terraform and applied through the CI/CD pipeline only — no manual console changes.

## SLA

| Target                  | Commitment                                               |
| ----------------------- | -------------------------------------------------------- |
| Production availability | 99.9% monthly uptime (source: signed SLA schedule A)     |
| P1 incident response    | 15 minutes, 24x7 (source: signed SLA schedule A)         |
| P2 incident response    | 1 business hour (source: signed SLA schedule A)          |
| Monthly reporting       | Delivered by the 5th business day (source: SLA schedule A) |

The 99.9% availability target was chosen over a higher tier to fit Acme's tolerance for a brief monthly maintenance window (source: Acme requirements workshop, 2026-05-12).

## Runbook

Standard change procedure for a platform release:

1. Open a change ticket and confirm the staging deploy is green.
2. Apply the Terraform plan to production via the pipeline (manual approval gate).
3. Run the post-deploy smoke suite; confirm Grafana dashboards are nominal.
4. Close the change ticket with the release notes attached.

Incident handling follows the on-call escalation path in Appendix B.

## Rollback

If a release fails the post-deploy smoke suite or breaches an SLA metric:

1. Re-apply the previous known-good Terraform state (tagged on every successful release).
2. Confirm the rollback via the smoke suite and dashboards.
3. Raise a P2 incident, attach the failed plan, and schedule a post-incident review within 48 hours.

Rollback is rehearsed quarterly against staging before any production change freeze.

## Go-Live Readiness

The following readiness gates were assessed at the go-live review.

### Gate — Monitoring

Prometheus alerts and Grafana dashboards cover the four golden signals for both services.

Verdict: PASS — alert routing verified end-to-end against PagerDuty on 2026-06-10.

### Gate — Backups

Cluster state and persistent volumes are snapshotted nightly with a tested restore procedure.

Verdict: PASS — restore drill completed successfully on 2026-06-11.

### Gate — Access Review

IAM roles and RBAC bindings were reviewed against least-privilege; break-glass access is logged.

Verdict: PASS — access matrix signed off by Acme security on 2026-06-12.

## Security & Compliance

Access is via SSO with MFA enforced; cluster admin requires break-glass approval that is audit-logged
to CloudTrail. Payment data is classified as restricted and excluded from logs by a redaction filter;
data at rest is encrypted with KMS. Quarterly access reviews are mandated by Acme's PCI-DSS
obligations.

## Cost/Effort Traceability

Effort is estimated at 42 person-days, mapped line-by-line to the scoped work in Appendix C; the
reusable Terraform modules are drawn from the shared platform library rather than re-built
(source: internal platform module registry).

## Risks

- **Capacity:** a payments traffic spike could exceed the staging-validated node count; mitigated by
  cluster autoscaling with a tested upper bound.
- **Dependency:** the RDS instances remain with Acme's DBA team, so a database incident is outside
  this SLA's control.
- **Change freeze:** the quarterly rollback rehearsal must not collide with Acme's PCI audit window.

## References

- Signed SLA schedule A, Acme Corp managed platform agreement, 2026-06-01.
- Acme requirements workshop notes, 2026-05-12.
- Internal platform module registry, shared Terraform library.
