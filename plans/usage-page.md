---
status: shipped
---

# Usage page

`visualia.space/usage`: what the class has used and what it cost, from the
gateway's `usage` table. **Everyone signed in sees it** (decision 2026-10-21):
the footprint is collective, and seeing it all year is how block D starts.

- Totals today, last 7 days, all time: cost, calls, tokens, failures.
- Per person (pseudonymous ids), per model (with average time), latest 30
  calls with project titles; failed calls shown faded with their error.
- No prompt text: the studio only reads counts.
- Money is Cloudflare's paid-rate price. Energy and CO₂ come later as ranges
  (coefficient table, see `schools/eka/docs/INFRA.md`).

First numbers (all test traffic): 38 calls, ~103k tokens, $0.15 in total.
