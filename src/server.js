// HTTP surface: POST /proposals, GET /ledger, GET / (ledger page).
// Zero dependencies — node:http only. The explainer is injected, so
// the same server runs on the mock offline or on SERV Reasoning live.

import http from 'node:http';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadPolicy, loadCharter } from './config.js';
import { createExplainer, createBudgetedExplainer } from './explainer.js';
import { Ledger } from './ledger.js';
import { processProposal } from './gate.js';

export function createGateServer({ explainer, policy, ledger }) {
  return http.createServer(async (req, res) => {
    try {
      if (req.method === 'POST' && req.url === '/proposals') {
        const raw = await readBody(req);
        let parsed;
        try {
          parsed = JSON.parse(raw);
        } catch {
          return sendJson(res, 400, { ok: false, errors: ['request body must be JSON'] });
        }
        const out = await processProposal({ proposal: parsed, explainer, policy, ledger });
        if (!out.ok) return sendJson(res, 400, { ok: false, errors: out.errors });
        return sendJson(res, 200, {
          ok: true,
          decision: out.decision,
          rule_fired: out.rule_fired,
          explanation: out.explanation,
          explainer_error: out.explainer_error,
          ledger_seq: out.record.seq,
        });
      }
      if (req.method === 'GET' && req.url === '/ledger') {
        return sendJson(res, 200, ledger.readAll());
      }
      if (req.method === 'GET' && req.url === '/') {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        return res.end(renderLedgerPage(ledger.readAll()));
      }
      return sendJson(res, 404, { ok: false, errors: ['not found'] });
    } catch (err) {
      return sendJson(res, 500, { ok: false, errors: [String(err?.message ?? err)] });
    }
  });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function sendJson(res, status, obj) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(obj));
}

function esc(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function renderLedgerPage(entries) {
  const rows = entries
    .map(
      (e) => `<tr>
        <td>${e.seq}</td><td>${esc(e.ts)}</td><td>${esc(e.proposal?.id)}</td>
        <td>${esc(e.proposal?.actor)}</td><td>${esc(e.proposal?.action)}</td>
        <td>${esc(e.proposal?.target)}</td><td>${esc(e.proposal?.amount ?? '')}</td>
        <td><strong>${esc(e.decision)}</strong></td><td>${esc(e.rule_fired)}</td>
        <td>${esc((e.explanation?.reasons ?? []).join(' '))}</td>
      </tr>`,
    )
    .join('\n');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>Explainable Gate — ledger</title>
<style>body{font-family:system-ui,sans-serif;margin:2rem}table{border-collapse:collapse}td,th{border:1px solid #ccc;padding:.35rem .6rem;text-align:left;vertical-align:top}</style>
</head><body>
<h1>Explainable Gate — decision ledger</h1>
<p>Append-only. Every row carries the decision, the rule that fired, and the explanation it was made with.</p>
<table><thead><tr><th>#</th><th>time</th><th>proposal</th><th>actor</th><th>action</th><th>target</th><th>amount</th><th>decision</th><th>rule fired</th><th>explanation</th></tr></thead>
<tbody>${rows}</tbody></table>
</body></html>`;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) {
  const policy = loadPolicy();
  const charter = loadCharter();
  const explainer = createBudgetedExplainer(createExplainer({ policy, charter }), { maxCalls: 5 });
  const ledger = new Ledger(process.env.LEDGER_PATH ?? 'ledger.jsonl');
  const port = Number(process.env.PORT ?? 8787);
  createGateServer({ explainer, policy, ledger }).listen(port, () => {
    console.log(`explainable-gate listening on http://localhost:${port} (explainer: ${explainer.name})`);
  });
}
