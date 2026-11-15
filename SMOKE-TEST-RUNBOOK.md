# Explainable Gate — smoke-test runbook (the moment the API key arrives)

**Event:** SERV Hackathon 02, Track 04 — Open Track
**Deadline:** Sunday, November 15, 2026, 6:59 p.m. ET
**Status at writing (November 15, re-verified):** offline pack is green — `npm test` **25 pass, 0 fail**; `npm run demo` (mock) reproduces all five designed verdicts in order. The **only** blocker is the OpenServ API key. Nothing has been submitted, published, or posted.
**Full source:** `~/workspace/hackathon-research-2026-11-14/SERV-round.md` §3 (steps 3.0 – 3.4). This file is the executable short form; on any conflict, SERV-round §3 governs.
**Elapsed target once the key exists:** 20 – 35 agent-minutes. Founder time: ~2 minutes (key) + the §6 submission taps.

---

## 0. Pre-flight — do these while waiting for the key (all free, no API calls)

```bash
cd ~/workspace/serv-explainable-gate
npm test        # expect: tests 25 · pass 25 · fail 0
npm run demo    # expect the five verdicts in §5 order, explainer: mock
```

- Confirm the swap surface: mode is chosen by `EXPLAINER=serv`; the real client (`src/serv-explainer.js`) requires `OPENSERV_API_KEY` and `SERV_MODEL_ID` in the environment and **fails loudly if either is missing — it never silently falls back to the mock**. If any live run prints `explainer: mock`, stop: the environment did not carry through.
- Candidate base model: **`gpt-5.4-mini`** (primary — the only candidate with a proven Multipath + strict-JSON record in this ecosystem). Cheap fallbacks, in order: `gpt-6-luna`, `gpt-5.6-luna`, `gpt-5.4-nano`, `gemini-3.1-flash-lite`.
- **Do not append the suffix yourself.** `buildServRequest` calls `multipathModelId()`, which appends `-serv-multipath` exactly once (idempotent). Set the bare base ID: `SERV_MODEL_ID=gpt-5.4-mini`. The wire model will be `gpt-5.4-mini-serv-multipath`.
- Expected request shape (pinned by the test suite): `POST https://inference-api.openserv.ai/v1/chat/completions`, `authorization: Bearer <key>`, charter (`prompts/charter.v1.md`, clauses C1 – C7) as the mandatory `system` message, proposal JSON as the `user` message, `response_format` strict JSON schema (`gate_explanation`), `reasoning_effort` `low` (`medium` only when the amount exceeds the human threshold of 200 — demo case 2 in practice). No output-token cap is sent — do not add one while debugging.
- Expected reply shape: `choices[0].message.content` parses to exactly `{ recommendation: "approve" | "deny" | "escalate", reasons: string[], risks: string[], missing_info: string[], policy_clauses_cited: string[] }`. `validateExplanation()` enforces it; anything else throws and the gate fails closed to ESCALATE (a deny rule that already fired still denies).
- Prepare an evidence scratch note with four blanks before the first call: **(a)** base model ID with suffix as sent; **(b)** per-call cost from the console; **(c)** SERV request ID(s); **(d)** total demo cost. These fill the slots in §6.

## 1. Key handling (first 2 minutes after it arrives)

- The founder supplies the key value (workspace "Snowden Zeng's Workspace", key "Mission Winning", created November 12 — its value was shown once and recorded nowhere) or regenerates it at console.openserv.ai → workspace → API keys. Regenerating invalidates the lost value — that is what we want.
- The key enters **only** as an environment variable in the shell that runs the test:

```bash
export OPENSERV_API_KEY=<value>   # never into a repo file, .env committed anywhere, chat record, or this folder
export SERV_MODEL_ID=gpt-5.4-mini
test -n "$OPENSERV_API_KEY" && echo set   # confirm presence WITHOUT printing the value — never echo the key
```

- Note the new key's name / date in the submission notes if regenerated — **not** its value.
- Workspace balance on record: **$1.00** (a $1.00 credit grant observed in billing, not the promised $5). Note the balance in the console before the first call.

## 2. Step 1 — the one-call probe (never fire the 5-proposal demo blind)

**Why probe outside the demo harness:** the demo wraps the explainer in `createBudgetedExplainer` with `maxCalls` = number of proposals = **5**. The demo has zero headroom — one wasted or retried call inside it exhausts the budget and the remaining proposals fail closed to ESCALATE for the wrong reason. Probe first, demo second.

- [ ] **Call 1 — one proposal only.** Run demo proposal 1 (routine approve: `demo-1-routine-approve`, `api_purchase` → `data-vendor.example`, amount 25) through the real client with `EXPLAINER=serv`, `SERV_MODEL_ID=gpt-5.4-mini`.
- [ ] Expected: HTTP 200, schema-valid explanation, recommendation `approve`, clauses cited including C1 / C7, final decision APPROVE via `model.recommendation`.
- [ ] **Manually read call 1's `reasons` even if validation passes** — the validator checks types, not length or refusal wording. A vacuous or refusal-style explanation is a stop condition (see §4).

## 3. Step 2 — read the console cost BEFORE any second call (budget gate)

- [ ] Open the OpenServ console **Usage** views (Cost / Performance / Tokens / Activity) and record for call 1: **total all-in cost, token counts, latency, and the request ID**.
- [ ] A single request can bill several components (upstream model inference, SERV reasoning generation, prompt-guard evaluation, audit / repair, shadow-agent validation). The first call for a given charter is expected to be the most expensive — it generates the Multipath reasoning prompt; calls 2 – 5 should hit the cached reasoning prompt, so do **not** extrapolate the demo cost as 5 × call 1.
- [ ] **Budget gate: proceed to the full demo only if call 1's all-in console cost is ≤ ≈ $0.05** against the $1.00 balance. Calibration: a charter + proposal + short structured reply is roughly 1 – 2K tokens per call (well under a cent of raw model cost on `gpt-5.4-mini`); a comparable published full run costs 2 – 8 cents.
- [ ] If call 1 costs materially more (say > $0.15): stop, switch the base model down the cheap list (`gpt-6-luna` first), and re-probe **once**. The $1.00 must cover the demo plus a safety margin for one re-run — not a model-comparison study.
- [ ] Note the remaining balance before and after the demo. If SERV rejects a request because the balance cannot cover its estimated ceiling, that is a balance signal, not a code bug. (While in Billing, note whether the $5 promised vs $1.00 observed credit is explained anywhere — record the observation only; do not open a support thread mid-smoke-test.)

## 4. Failure diagnosis — match the symptom, in this order

| Symptom | Meaning / fix |
|---|---|
| `OPENSERV_API_KEY is not set` / `SERV_MODEL_ID is not set` | Our own client, thrown before any network call. Fix the export / invocation. Nothing was billed. |
| HTTP 401 / 403 | Key invalid, revoked (e.g. old value after regeneration), or wrong workspace. Stop; do not retry-loop. Founder re-copies or regenerates. Code is not implicated. |
| HTTP 400 naming the model | Bad base ID or unsupported Multipath combination. Check the ID is copied exactly from the current Models page and that `SERV_MODEL_ID` holds the **base** ID (client appends the suffix). Fall back to `gpt-5.4-mini` if a cheap model is the suspect. |
| HTTP 400 mentioning the system prompt | Should be impossible (charter is always the system message). Capture the raw error verbatim before changing anything — it would mean the request builder diverged from `buildServRequest`, which the tests pin. |
| HTTP 429 or 5xx | Transient / rate limit. The client has a 30-second timeout and **no retry** by design. Wait, then re-run the **single probe once**. Do not add retry logic during the smoke test. |
| HTTP 200 but schema / parse error | Capture the **raw `content` string** first. Known causes: (a) JSON wrapped in markdown fences or prose; (b) refusal / too-short non-answer; (c) reasoning-prompt transformation mangled the output instruction (we send no Kronos suffix — suspect (a) or (b) first). Sanctioned next step: one probe on the alternate candidate model. **Never loosen `validateExplanation` or the schema to make a bad reply pass** — that destroys the entry's central claim. |
| HTTP 200, valid schema, "wrong" judgment | **Not a smoke-test failure.** The decider invariant guarantees the decision regardless (cap → DENY, deny list → DENY, missing info → ESCALATE, injection pattern → ESCALATE via the deterministic scan). Record the model's actual wording verbatim — a sympathetic `approve` on the over-cap case is the demo's money shot. Only a vacuous / refusal explanation is a stop condition. |

**Abort criteria — stop and escalate to the founder with the facts if any hold:**

1. The key is rejected after one regeneration; or
2. Call 1's all-in cost makes 5 calls + one re-run exceed the $1.00 balance on every candidate model tried (cap: **two candidate models, three probe calls total**); or
3. Two consecutive probes return refusal / vacuous explanations on different models.

On abort, the founder's call (~1 minute) is: submit with the mock honestly disclosed (`WRITEUP.md` already discloses it) or record a deliberate pass. **Do not burn the balance to zero probing.**

## 5. Step 3 — the full live demo (only after §2 – §3 pass)

```bash
EXPLAINER=serv OPENSERV_API_KEY=<value> SERV_MODEL_ID=gpt-5.4-mini npm run demo
```

- [ ] Expect exactly **5 live calls** (the budgeted wrapper caps at exactly 5) and the designed decision sequence:

| # | Proposal | Decision | Rule fired |
|---|---|---|---|
| 1 | `demo-1-routine-approve` | APPROVE | `model.recommendation` |
| 2 | `demo-2-over-cap-deny` | DENY | `cap.hard_cap` |
| 3 | `demo-3-deny-list-deny` | DENY | `deny_list.target` |
| 4 | `demo-4-ambiguous-escalate` | ESCALATE | `info.missing_information` |
| 5 | `demo-5-injection-attempt` | ESCALATE | `security.injection_pattern` |

- [ ] Any proposal showing `explainer error:` means a call failed and the gate failed closed — that run is **not** the submission transcript. Diagnose from §4, fix the cause, and re-run only if the remaining balance covers it with margin.
- [ ] Capture, in this order, before touching any file: **(1)** the full terminal transcript; **(2)** the resulting `demo/demo-ledger.jsonl` (it names `serv` as the explainer, unlike the mock ledger); **(3)** the console Usage → Activity rows for the 5 calls — per-call cost, total demo cost, at least the first call's request ID; **(4)** the remaining balance.
- [ ] This live run is also the demo-video capture (~3 minutes of terminal) — record it in this session, not as a separate one (founder approves the upload / link).

## 6. What gets pasted into the slots afterward

Fill from the captured facts only — never from estimates.

**Slot 1 + Slot 2 — `SUBMISSION-PACK.md` §3, "How it works", step 2** (the only two `[AWAITING SMOKE TEST]` slots in the pack):

- Current text: `Model used: [AWAITING SMOKE TEST — exact base model ID with its -serv-multipath suffix]. Measured cost: [AWAITING SMOKE TEST — measured per-call cost against the workspace balance].`
- Paste: the exact model ID **as sent** — e.g. `gpt-5.4-mini-serv-multipath` (base ID actually used + suffix) — and the **measured per-call cost** from the console (plus the total demo cost and the balance it was measured against, e.g. "≈ $X per call; $Y total for the 5-call demo against the workspace's $1.00 balance").

**Mirror — `WRITEUP.md`, "How SERV Reasoning powers it" paragraph:**

- Current bracket: `[Exact base model ID with its -serv-multipath suffix, and the measured per-call cost against the workspace balance, are filled in at the real-API smoke test.]`
- Replace the whole bracket with the same two facts in sentence form.

**Also at fill-in time (submission steps, not smoke-test slots):**

- `WRITEUP.md` Demo section: replace `(Recorded demo link added at submission.)` with the recorded demo link.
- `WRITEUP.md` optional bracket `[Stretch, if it lands before submission: prompt-injection guard via SERV Tools …]` — delete it at submission if the stretch did not land (it has not, as of this runbook); do not leave it in the submitted text.
- README: update the transcript section to the **live** transcript, keeping the mock transcript clearly labelled as the offline record — do not overwrite the mock/live distinction silently.
- Re-run `npm test` after any doc edit (expect 25 / 25 still) and confirm cleanliness: no key, no `.env`, no balance screenshot with account identifiers in anything destined for the public repo.

## 7. After the smoke test — founder submission taps (~15 minutes, before 6:59 p.m. ET)

Submission = public repo + demo link or video + write-up + a mandatory X post whose link goes in the submission form (**post first, form second**). Form answers are final in `SUBMISSION-PACK.md` §3 (with the two slots filled per §6 above); X post drafts are in `~/workspace/hackathon-prep-2026-11-13/SERV-FOUNDER-CHECKLIST.md`.

1. Public-repo GO (~2 min).
2. Demo video of the live run (~5 – 10 min — agent can record; upload / link is the founder's approval).
3. X post first, then the submission form with the post link (~10 min).
