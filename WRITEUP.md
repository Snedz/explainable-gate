# Explainable Gate — the model explains, the rule decides.

**Track: 04 Open Track** · SERV Hackathon 02

> Live, the model recommended escalate on the over-cap purchase. The cap denied it.

## Problem

Agents don't just spend. They merge code, deploy services, send
messages and payments, delete data — irreversible actions taken at
machine speed. Most agent-governance tooling gates only the money:
a wallet policy, a spending cap, a payment rail. The actions that
can hurt you most have no gate at all. And letting the same model
that proposes an action also approve it collapses the audit trail
into a vibe: fluent explanations can talk a system into anything,
and a prompt injection in the input becomes an approval. Edition
01's strongest entries showed the demand for governed agents; the
open problem is making the governance itself inspectable — for
everything an agent can do, not just what it can buy.

## What it does

Explainable Gate is a small approval service for agent actions. An
agent submits a proposal (actor, action, amount, target, rationale).
SERV Reasoning assesses it against a written policy charter and
returns a structured explanation — recommendation, reasons, risks,
missing information, clauses cited. A deterministic rule engine then
decides: caps, deny lists, and human-escalation thresholds are code,
not prompt. The model's recommendation can tighten an outcome but
never loosen one. Every decision is written to an append-only ledger
with the explanation and the rule that fired, so an auditor can replay
exactly why anything was approved, denied, or escalated. No wallet,
no chain, no Passport required: the gate sits in front of the action
itself, so it governs a merge or a deletion exactly the way it
governs a purchase. Caps and the ledger are supporting detail; the
gate over actions is the product.

## How SERV Reasoning powers it

The explainer calls `POST /v1/chat/completions` on
`https://inference-api.openserv.ai`, with the governance charter as
the (mandatory) system prompt — versioned in the repo at
`prompts/charter.v1.md`, per OpenServ's own integration doctrine — the
Multipath model-ID suffix on the base model, a strict JSON-schema
response format for the explanation, and `reasoning_effort` set to
`low` by default and `medium` for proposals above the
human-approval threshold. Multipath is on; Kronos is deliberately
off, because Kronos rewrites the prompt and a rewritten prompt could
break the strict-JSON schema the ledger depends on. Live run
(November 15, 2026): the model ID as sent was
`gpt-5.4-mini-serv-multipath` (base `gpt-5.4-mini`, underlying
`gpt-5.4-mini-2026-03-17`), and the measured cost was
$0.002–$0.01 per SERV Reasoning call across the seven live calls —
the five-call live demo run cost $0.022 in total — verified in the
OpenServ console (Usage → Activity) against the workspace balance. SERV
does the judgment work it is designed for — weighing ambiguous
proposals against competing constraints — and is deliberately never
asked to do arithmetic, enforce caps, or make the final call.
[Stretch, if it lands before submission: prompt-injection guard via
SERV Tools on the injection demo case; v1 already handles that case by
charter clause C6 plus a deterministic pattern scan in the decider.]

*Build-state honesty:* the service was built and verified end to
end offline first, on a mock explainer that implements the identical
interface and response schema. The live run has since been made: on
November 15, 2026, with a regenerated workspace key supplied as an
environment variable only, the same five-proposal demo ran against
real SERV Reasoning and reproduced all five designed verdicts. The
evidence lives in the README (the live transcript), the captured
run output, the run's append-only ledger, and the recorded live
demo video. The real client is a single module
(`src/serv-explainer.js`) behind the mock's interface; the mock
remains the offline path.

## Demo

Five scripted proposals: a routine approve; an over-cap denial where
the rule overrules a sympathetic explanation (the model recommends
approve, the hard cap denies); a deny-list denial; an ambiguous case
escalated to a human for missing information; and a prompt-injection
attempt that changes nothing and is recorded in the ledger.
`npm run demo` reproduces all five offline; run with
`EXPLAINER=serv` it makes the identical five calls against SERV
Reasoning — done live on November 15, 2026, with all five verdicts
reproduced. The README carries both transcripts: the live run
first, the offline mock below it, labelled. (Recorded demo link
added at submission.)

## Built during the event

The entire service is a new repo, built for this event (November
2026): zero-dependency Node, 25 automated tests covering the
never-loosen invariant, the append-only ledger, and the end-to-end
flow. The propose–explain–decide pattern comes from our fleet's
existing governance work; no code from it is reused here, and no other
entry of ours is modified — in particular, our BondGate repo, which is
mid-judging in another event, is untouched.

## Why it matters / revenue potential

(Potential, not traction — no users or revenue exist.) The buyer is
any team running agents with merge, deploy, send, or spend
permissions — and, behind them, the audit and compliance owner who
has to answer for what those agents did. The potential offer:
$0.10–$0.25 per gated decision, or $49 per agent per month for teams
that want a flat line. The margin logic is cost-plus on a measured
input: each decision costs one SERV Reasoning call at the measured
per-call cost recorded at the smoke test above, so a per-decision
price set an order of magnitude above that unit cost covers the
call, the ledger storage, and the service margin at any volume. On the judging axes: creativity — inverting
the usual pattern, so the model advises and the rule decides; user
readiness — environment variables only to go live, zero dependencies, a
scripted demo that runs offline; revenue potential — the governance
layer every agent fleet eventually buys. The pattern is adjacent to
Kite's operator-controlled spending limits, implemented stack-free.
