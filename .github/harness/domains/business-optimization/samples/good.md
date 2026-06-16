# Business Case — Invoice-to-Pay Automation, Procurement Operations

## Current State

The accounts-payable team processes vendor invoices through a manual, three-touch workflow: data
entry, matching, and approval routing. The current baseline, measured over the FY25 fiscal year:

- Average invoice cycle time: 9.4 days[^ap-timestudy]
- Invoices processed per FTE per month: 640[^ap-timestudy]
- Exception/rework rate: 18% of invoices require manual rework[^ap-finance]
- Annual software licensing for the legacy entry tool: $120,000[^ap-finance]

These are the constraints the proposal must respect: no headcount reduction beyond attrition, and the
new tooling must integrate with the existing ERP.

## Proposed Change

Replace the manual entry-and-matching steps with an OCR capture and automated three-way match,
routing only true exceptions to a human. The legacy entry tool is retired and folded into the ERP
vendor's add-on module. The approval policy is unchanged.

## Impact

The annualized benefit is built from three independent components, with no double-counting between
labor and rework (rework hours are excluded from the labor-savings base):

<!-- reconcile -->
- Labor savings (redeployed AP hours): 410,000
- Rework reduction savings: 95,000
- License consolidation savings: 120,000
- Total annual savings: 625,000
<!-- /reconcile -->

Automated matching is projected to reduce the exception rate from 18% to roughly 6%[^vendor-bench],
and to shorten average cycle time by about 40%[^vendor-bench] based on the ERP vendor's published
deployment benchmarks for comparable mid-market AP volumes.

## Risks

- **OCR accuracy on non-standard invoices:** scanned PDFs from small vendors may mis-capture. Mitigation:
  a confidence threshold routes low-confidence captures to manual review for the first two quarters.
- **ERP integration slippage:** the add-on module depends on a Q3 ERP upgrade. Mitigation: phase the
  rollout behind the upgrade milestone, with a go/no-go gate.
- **Change resistance in the AP team:** redeployment, not redundancy, must be communicated early.
  Mitigation: redeployment plan agreed with the function lead before launch.

## Recommendation

Proceed with a phased rollout. The $300,000 implementation cost against $625,000 annual savings yields
a payback inside one fiscal year, consistent with the steering committee's mandate for sub-18-month
payback on operational investments. Reusable components — the OCR confidence-routing logic and the
benefit model — are factored out for the parallel expense-report initiative rather than re-derived.

## Sources

[^ap-timestudy]: AP time study, Procurement Operations, conducted 2025-11-10.
[^ap-finance]: FY2025 AP cost and exception report, Finance shared service, dated 2026-01-15.
[^vendor-bench]: ERP vendor AP-automation deployment benchmark report, mid-market cohort, 2026-02.
