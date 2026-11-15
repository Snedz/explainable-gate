// The gate flow, shared by the HTTP server, the demo, and the tests:
//   proposal -> boundary validation -> explainer -> decider -> ledger
// An explainer failure (network, budget, bad reply) never propagates:
// the decider receives no explanation and fails closed.

import { validateProposal } from './validate.js';
import { decide } from './decider.js';

export async function processProposal({ proposal, explainer, policy, ledger }) {
  const check = validateProposal(proposal);
  if (!check.ok) {
    return { ok: false, errors: check.errors };
  }
  const p = check.proposal;

  let explanation = null;
  let explainerError = null;
  try {
    explanation = await explainer.explain(p);
  } catch (err) {
    explainerError = String(err?.message ?? err);
  }

  const d = decide({ proposal: p, explanation, policy });
  const record = ledger.append({
    proposal: p,
    explainer: explainer.name ?? 'unknown',
    explanation,
    explainer_error: explainerError,
    decision: d.decision,
    rule_fired: d.rule_fired,
    rule_trace: d.rule_trace,
    model_recommendation: d.model_recommendation,
  });

  return {
    ok: true,
    decision: d.decision,
    rule_fired: d.rule_fired,
    explanation,
    explainer_error: explainerError,
    record,
  };
}
