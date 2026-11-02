---
status: idea
---

# Taste rules: readable, owned by the student

A proposal from a claude.ai chat (2026-10-28, brought in 2026-11-02). It
depends on `board-sight.md` (records and edits an agent can read) and keeps to
`backstage.md`. Research behind it: `research/taste.md`.

**Goal.** A student can ask "what patterns do you see in my choices?" and get
rules they can read, keep, edit or delete. Nothing runs in the background.

## 1. How a rule is made (CIPHER with Clef)

On request, over edits the student selects:

1. Clef types each change: `taste | fix | content`. Only taste changes count.
2. An LLM through the gateway reads before and after and writes one preference
   in words.
3. The rule is shown to the student, who keeps, edits or drops it.

## 2. How a kept rule is used

When the student asks the agent to make or change something:

1. Rules from similar contexts are retrieved.
2. Clef asks of each: does it apply here?
3. The agent works with the chosen rules; Clef checks the result against each.
4. Unsure results are shown as questions, not silently fixed.

Rule weights are counters the student can see; nothing is a hidden model.

## 3. Sharing

A student may offer a rule to the class. A teacher may promote rules into a
shared skill. Both are explicit, both are credited.

## 4. Optional: a small taste scorer

Logistic regression or a small MLP over layout metrics, trained on nudge pairs
(after beats before). A few KB, trained in milliseconds, run in the board page
(plain JS or Rust compiled to WASM); no pool needed. Only worth it for snapping
and suggestions while dragging, or ranking many candidates without model
calls. Kept with the student's other rules, under the same rule.

## 5. Order

1. Rule-making on request, keep, edit, drop.
2. Using kept rules in agent requests.
3. Sharing and promotion.
4. The scorer, if dragging needs it.

## 6. Open questions

- Clef has no published calibration or Estonian results: rules in English
  first, or calibrate.
- Where rules live: in the student's project folder (owned) or D1.
