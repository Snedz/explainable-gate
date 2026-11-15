// Ledger tests: append-only behaviour and the audit shape — every
// record carries the decision, the explanation, and the rule fired.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Ledger } from '../src/ledger.js';

function tempLedger() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-ledger-'));
  return new Ledger(path.join(dir, 'ledger.jsonl'));
}

const entry = (overrides = {}) => ({
  proposal: { id: 'p-1', actor: 'a', action: 'api_purchase', target: 'vendor.example', amount: 10, rationale: 'r' },
  explainer: 'mock',
  explanation: {
    recommendation: 'approve',
    reasons: ['fine'],
    risks: [],
    missing_info: [],
    policy_clauses_cited: ['C1'],
  },
  explainer_error: null,
  decision: 'APPROVE',
  rule_fired: 'model.recommendation',
  rule_trace: [],
  model_recommendation: 'approve',
  ...overrides,
});

test('append writes JSONL records and readAll round-trips them', () => {
  const ledger = tempLedger();
  ledger.append(entry());
  ledger.append(entry({ decision: 'DENY', rule_fired: 'cap.hard_cap' }));
  const all = ledger.readAll();
  assert.equal(all.length, 2);
  assert.equal(all[0].decision, 'APPROVE');
  assert.equal(all[1].decision, 'DENY');
  // Raw file is one JSON object per line.
  const lines = fs.readFileSync(ledger.filePath, 'utf8').trim().split('\n');
  assert.equal(lines.length, 2);
  assert.doesNotThrow(() => lines.forEach((l) => JSON.parse(l)));
});

test('seq increments monotonically starting at 1', () => {
  const ledger = tempLedger();
  const a = ledger.append(entry());
  const b = ledger.append(entry());
  const c = ledger.append(entry());
  assert.deepEqual([a.seq, b.seq, c.seq], [1, 2, 3]);
});

test('every record carries decision, explanation, and rule fired', () => {
  const ledger = tempLedger();
  const rec = ledger.append(entry());
  assert.equal(rec.decision, 'APPROVE');
  assert.equal(rec.rule_fired, 'model.recommendation');
  assert.equal(rec.explanation.recommendation, 'approve');
  assert.equal(rec.proposal.id, 'p-1');
  assert.ok(typeof rec.ts === 'string' && !Number.isNaN(Date.parse(rec.ts)));
});

test('append-only surface: no update, delete, or rewrite methods exist', () => {
  const ledger = tempLedger();
  for (const name of ['update', 'delete', 'remove', 'clear', 'rewrite', 'edit']) {
    assert.equal(typeof ledger[name], 'undefined', `Ledger must not expose ${name}()`);
  }
});

test('earlier lines are byte-identical after later appends', () => {
  const ledger = tempLedger();
  ledger.append(entry());
  const before = fs.readFileSync(ledger.filePath, 'utf8');
  ledger.append(entry({ decision: 'ESCALATE', rule_fired: 'threshold.human_review' }));
  ledger.append(entry({ decision: 'DENY', rule_fired: 'deny_list.target' }));
  const after = fs.readFileSync(ledger.filePath, 'utf8');
  assert.ok(after.startsWith(before), 'history must never be rewritten');
});

test('readAll on a missing file is an empty ledger, not an error', () => {
  const ledger = tempLedger();
  assert.deepEqual(ledger.readAll(), []);
});
