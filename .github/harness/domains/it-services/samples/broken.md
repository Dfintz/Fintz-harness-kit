# Statement of Work — Acme Corp Managed Kubernetes Platform

## Scope

This engagement delivers a managed Kubernetes platform for Acme Corp's payments team.

In scope:

- Provisioning of one production and one staging EKS cluster in `eu-west-1`.
- 24x7 monitoring and on-call response per the SLA below.

Out of scope:

- Application code changes inside the payments services themselves.

## Architecture

Two isolated EKS clusters (staging, production), each with private node groups behind a network load
balancer. We run the best monitoring stack in the industry to keep the platform healthy.

## SLA

| Target                  | Commitment              |
| ----------------------- | ----------------------- |
| Production availability | 99.9% uptime            |
| P1 incident response    | as fast as possible     |

## Runbook

Standard change procedure for a platform release:

1. Open a change ticket and confirm the staging deploy is green.
2. Apply the Terraform plan to production via the pipeline.
3. Run the post-deploy smoke suite.

## Go-Live Readiness

### Gate — Monitoring

Prometheus alerts and Grafana dashboards cover the golden signals.

Verdict: PASS — alert routing verified on 2026-06-10.

### Gate — Backups

Cluster state and persistent volumes are snapshotted nightly.

### Gate — Access Review

IAM roles were reviewed against least-privilege.

Verdict: PASS — access matrix signed off on 2026-06-12.

## Risks

- **Capacity:** a payments traffic spike could exceed the validated node count.
