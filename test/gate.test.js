// End-to-end offline tests: the five demo proposals through the real
// gate flow (validation -> mock explainer -> decider -> ledger), plus
// the SERV call-shape builder and the call-budget guard.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPolicy, loadCharter } from '../src/config.js';
import {
  buildServRequest,
  createBudgetedExplainer,
  createExplainer,
  multipathModelId,
} from '../src/explainer.js';
import { Ledger } from '../src/ledger.js';
import { processProposal } from '../src/gate.js';

const policy = loadPolicy();
const charter = loadCharter();
const HERE = path.dirname(fileURLToPath(import.meta.url));
const demoProposals = JSON.parse(
  fs.readFileSync(path.join(HERE, '..', 'demo', 'proposals.json'), 'utf8'),
);

function tempLedger() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-e2e-'));
  return new Ledger(path.join(dir, 'ledger.jsonl'));
}

test('the five demo proposals produce the designed decisions, in order', async () => {
  const explainer = createExplainer({ policy, charter });
  const ledger = tempLedger();
  const decisions = [];
  for (const proposal of demoProposals) {
    const out = await processProposal({ proposal, explainer, policy, ledger });
    assert.equal(out.ok, true, `${proposal.id} should validate`);
    decisions.push([proposal.id, out.decision, out.rule_fired]);
  }
  assert.deepEqual(decisions, [
    ['demo-1-routine-approve', 'APPROVE', 'model.recommendation'],
    ['demo-2-over-cap-deny', 'DENY', 'cap.hard_cap'],
    ['demo-3-deny-list-deny', 'DENY', 'deny_list.target'],
    ['demo-4-ambiguous-escalate', 'ESCALATE', 'info.missing_information'],
    ['demo-5-injection-attempt', 'ESCALATE', 'security.injection_pattern'],
  ]);
  assert.equal(ledger.readAll().length, 5);
});

test('an invalid proposal is rejected at the boundary and never reaches the ledger', async () => {
  const explainer = createExplainer({ policy, charter });
  const ledger = tempLedger();
  const out = await processProposal({ proposal: { actor: 'a' }, explainer, policy, ledger });
  assert.equal(out.ok, false);
  assert.ok(out.errors.length > 0);
  assert.equal(ledger.readAll().length, 0);
});

test('an explainer that throws fails closed: ESCALATE, recorded in the ledger', async () => {
  const explainer = { name: 'broken', async explain() { throw new Error('boom'); } };
  const ledger = tempLedger();
  const out = await processProposal({ proposal: demoProposals[0], explainer, policy, ledger });
  assert.equal(out.decision, 'ESCALATE');
  assert.equal(out.rule_fired, 'fail_closed.malformed_explanation');
  assert.equal(out.explainer_error, 'boom');
  assert.equal(ledger.readAll()[0].explainer_error, 'boom');
});

test('SERV request shape: Multipath suffix, charter as system prompt, schema, effort', () => {
  const req = buildServRequest({
    proposal: { ...demoProposals[0] },
    charter,
    policy,
    baseModelId: 'base-model-x',
  });
  assert.equal(req.url, 'https://inference-api.openserv.ai/v1/chat/completions');
  assert.equal(req.body.model, 'base-model-x-serv-multipath');
  assert.equal(req.body.messages[0].role, 'system');
  assert.equal(req.body.messages[0].content, charter);
  assert.equal(req.body.response_format.json_schema.name, 'gate_explanation');
  assert.equal(req.body.reasoning_effort, 'low');
  // Above the human threshold -> medium.
  const big = buildServRequest({ proposal: { ...demoProposals[1] }, charter, policy, baseModelId: 'base-model-x' });
  assert.equal(big.body.reasoning_effort, 'medium');
  // Suffix is appended once, never twice.
  assert.equal(multipathModelId('base-model-x-serv-multipath'), 'base-model-x-serv-multipath');
});

test('call-budget guard: calls past the cap throw (and the gate fails closed on them)', async () => {
  const budgeted = createBudgetedExplainer(createExplainer({ policy, charter }), { maxCalls: 2 });
  await budgeted.explain(demoProposals[0]);
  await budgeted.explain(demoProposals[0]);
  await assert.rejects(() => budgeted.explain(demoProposals[0]), /budget exhausted/);
  assert.equal(budgeted.callsUsed(), 2);
});
