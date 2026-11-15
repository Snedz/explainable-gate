// Scripted demo: boots the real HTTP server with the mock explainer
// (fully offline), posts the five proposals from proposals.json, and
// prints each decision, the explanation, and the rule that fired.
// Set EXPLAINER=serv (plus OPENSERV_API_KEY and SERV_MODEL_ID) to run
// the identical demo against SERV Reasoning once the key exists.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPolicy, loadCharter } from '../src/config.js';
import { createExplainer, createBudgetedExplainer } from '../src/explainer.js';
import { Ledger } from '../src/ledger.js';
import { createGateServer } from '../src/server.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const proposals = JSON.parse(fs.readFileSync(path.join(HERE, 'proposals.json'), 'utf8'));

// Fresh demo ledger each run, so the transcript below is complete.
// (The Ledger class itself only ever appends; resetting the demo's
// own scratch file is the harness's choice, not a ledger operation.)
const ledgerPath = path.join(HERE, 'demo-ledger.jsonl');
fs.rmSync(ledgerPath, { force: true });

const policy = loadPolicy();
const charter = loadCharter();
const explainer = createBudgetedExplainer(createExplainer({ policy, charter }), {
  maxCalls: proposals.length,
});
const ledger = new Ledger(ledgerPath);
const server = createGateServer({ explainer, policy, ledger });

await new Promise((resolve) => server.listen(0, resolve));
const base = `http://127.0.0.1:${server.address().port}`;

console.log(`Explainable Gate — demo (explainer: ${explainer.name}, offline mock, no network)`);
console.log(`Policy: hard cap ${policy.hard_cap}, human threshold ${policy.human_threshold}, deny targets [${policy.deny_targets.join(', ')}]\n`);

let n = 0;
for (const proposal of proposals) {
  n += 1;
  const res = await fetch(`${base}/proposals`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(proposal),
  });
  const out = await res.json();
  console.log(`${n}. ${proposal.id} — ${proposal.action} -> ${proposal.target} (amount ${proposal.amount ?? 0})`);
  console.log(`   DECISION: ${out.decision}   rule fired: ${out.rule_fired}`);
  if (out.explanation) {
    console.log(`   model recommended: ${out.explanation.recommendation} [${out.explanation.policy_clauses_cited.join(', ')}]`);
    for (const r of out.explanation.reasons) console.log(`   reason: ${r}`);
    for (const r of out.explanation.risks) console.log(`   risk: ${r}`);
    for (const m of out.explanation.missing_info) console.log(`   missing: ${m}`);
  }
  if (out.explainer_error) console.log(`   explainer error: ${out.explainer_error}`);
  console.log('');
}

const entries = await (await fetch(`${base}/ledger`)).json();
console.log(`Ledger: ${entries.length} decisions appended to demo/demo-ledger.jsonl (seq ${entries[0]?.seq}..${entries.at(-1)?.seq}).`);
server.close();
