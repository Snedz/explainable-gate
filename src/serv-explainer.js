// The real SERV Reasoning client — the ONE module that changes when
// the mock is swapped out. Nothing else in the repo knows the API
// exists: the server, demo, decider, and ledger all talk to the
// explainer interface in explainer.js.
//
// STATUS: not yet exercised. The workspace API key ("Mission Winning",
// created Nov 12) was shown once at creation and recorded nowhere, so
// the smoke test is blocked until the founder supplies or regenerates
// it. With no key in the environment this module fails loudly and
// specifically — it never silently falls back to the mock.

import { buildServRequest, validateExplanation } from './explainer.js';

export class ServKeyMissingError extends Error {
  constructor() {
    super(
      'OPENSERV_API_KEY is not set. The real SERV Reasoning smoke test is blocked ' +
        'until the founder supplies or regenerates the OpenServ workspace API key.',
    );
    this.name = 'ServKeyMissingError';
  }
}

export function createServExplainer({
  apiKey = process.env.OPENSERV_API_KEY,
  baseModelId = process.env.SERV_MODEL_ID,
  charter,
  policy,
  fetchImpl = fetch,
  timeoutMs = 30_000,
} = {}) {
  return {
    name: 'serv',

    async explain(proposal) {
      if (!apiKey) throw new ServKeyMissingError();
      if (!baseModelId) {
        throw new Error(
          'SERV_MODEL_ID is not set. Pick the base model from the OpenServ catalog at ' +
            'smoke-test time; buildServRequest adds the -serv-multipath suffix.',
        );
      }
      const { url, body } = buildServRequest({ proposal, charter, policy, baseModelId });
      const res = await fetchImpl(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!res.ok) {
        throw new Error(`SERV Reasoning request failed: HTTP ${res.status}`);
      }
      const data = await res.json();
      const content = data?.choices?.[0]?.message?.content;
      const parsed = typeof content === 'string' ? JSON.parse(content) : content;
      const check = validateExplanation(parsed);
      if (!check.ok) {
        throw new Error(`SERV reply failed schema validation: ${check.errors.join('; ')}`);
      }
      return parsed;
    },
  };
}
