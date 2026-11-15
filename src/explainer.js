// The explainer interface, plus everything about the SERV Reasoning
// call shape that is shared between the real client and the mock.
//
// An "explainer" is any object with:
//   { name: string, explain(proposal) -> Promise<explanation> }
// where `explanation` matches EXPLANATION_SCHEMA. Swapping the mock for
// the real SERV client is exactly one module: src/serv-explainer.js.

import { createMockExplainer } from './mock-explainer.js';
import { createServExplainer } from './serv-explainer.js';

export const SERV_BASE_URL = 'https://inference-api.openserv.ai';
export const MULTIPATH_SUFFIX = '-serv-multipath';

export const EXPLANATION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['recommendation', 'reasons', 'risks', 'missing_info', 'policy_clauses_cited'],
  properties: {
    recommendation: { type: 'string', enum: ['approve', 'deny', 'escalate'] },
    reasons: { type: 'array', items: { type: 'string' } },
    risks: { type: 'array', items: { type: 'string' } },
    missing_info: { type: 'array', items: { type: 'string' } },
    policy_clauses_cited: { type: 'array', items: { type: 'string' } },
  },
};

export function validateExplanation(raw) {
  const errors = [];
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, errors: ['explanation must be an object'] };
  }
  if (!['approve', 'deny', 'escalate'].includes(raw.recommendation)) {
    errors.push('recommendation must be one of approve | deny | escalate');
  }
  for (const field of ['reasons', 'risks', 'missing_info', 'policy_clauses_cited']) {
    if (!Array.isArray(raw[field]) || raw[field].some((v) => typeof v !== 'string')) {
      errors.push(`${field} must be an array of strings`);
    }
  }
  return { ok: errors.length === 0, errors };
}

// Multipath is a model-ID suffix, not a tool (OpenServ docs, Multipath
// tutorial): append `-serv-multipath` once to a supported base model ID
// and SERV transforms the branching system prompt before routing.
export function multipathModelId(baseModelId) {
  return baseModelId.endsWith(MULTIPATH_SUFFIX) ? baseModelId : baseModelId + MULTIPATH_SUFFIX;
}

// Docs, Day One: start at low effort; medium when several constraints
// interact or evidence is ambiguous. Here: above the human threshold.
export function pickReasoningEffort(proposal, policy) {
  return (proposal.amount ?? 0) > policy.human_threshold ? 'medium' : 'low';
}

// Builds the exact request the real client sends. Pure: the mock path
// and the tests can inspect the call shape without any network.
export function buildServRequest({ proposal, charter, policy, baseModelId }) {
  return {
    url: `${SERV_BASE_URL}/v1/chat/completions`,
    method: 'POST',
    body: {
      model: multipathModelId(baseModelId),
      messages: [
        { role: 'system', content: charter },
        {
          role: 'user',
          content: JSON.stringify({
            task: 'Assess this agent-action proposal against the charter. Reply with the structured explanation only.',
            proposal,
          }),
        },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'gate_explanation', strict: true, schema: EXPLANATION_SCHEMA },
      },
      reasoning_effort: pickReasoningEffort(proposal, policy),
    },
  };
}

// Credit-budget guard: the workspace balance is $1.00, so every
// explainer used by the server/demo is wrapped with a hard per-run
// call cap (default 5 — exactly the demo). A call past the cap throws,
// and the decider fails closed on a missing explanation.
export function createBudgetedExplainer(explainer, { maxCalls = 5 } = {}) {
  let calls = 0;
  return {
    name: explainer.name,
    callsUsed: () => calls,
    maxCalls,
    async explain(proposal) {
      if (calls >= maxCalls) {
        throw new Error(`explainer call budget exhausted (${maxCalls} calls); refusing further calls`);
      }
      calls += 1;
      return explainer.explain(proposal);
    },
  };
}

// mode: 'mock' (default, fully offline) | 'serv' (real OpenServ client;
// requires OPENSERV_API_KEY and SERV_MODEL_ID in the environment).
export function createExplainer({ mode, policy, charter } = {}) {
  const resolved = mode ?? process.env.EXPLAINER ?? 'mock';
  if (resolved === 'serv') return createServExplainer({ policy, charter });
  if (resolved === 'mock') return createMockExplainer({ policy });
  throw new Error(`unknown explainer mode: ${resolved} (expected "mock" or "serv")`);
}
