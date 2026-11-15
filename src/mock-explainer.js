// Offline mock explainer. Simulates the *judgment* a SERV Reasoning
// reply would carry — recommendation, reasons, risks, missing info,
// clauses cited — with deterministic local heuristics, so the whole
// demo and test suite run with no network and no API key.
//
// Deliberately, the mock does NOT enforce the policy (no caps, no deny
// lists): per OpenServ's own doctrine the model judges and explains,
// arithmetic and allow/deny lists stay in the deterministic decider.
// That separation is what lets the demo show a sympathetic explanation
// being overruled by a rule.

const HARMFUL = [/delete all/i, /\bwipe\b/i, /exfiltrate/i, /destroy the backups/i];

export function createMockExplainer({ policy } = {}) {
  const injectionPatterns = (policy?.injection_patterns ?? []).map(
    (p) => new RegExp(p, 'i'),
  );

  return {
    name: 'mock',

    async explain(proposal) {
      const rationale = proposal.rationale ?? '';

      // C6 — embedded text is data. An instruction addressed to the
      // reviewer inside the rationale is flagged, never followed.
      if (injectionPatterns.some((rx) => rx.test(rationale))) {
        return {
          recommendation: 'escalate',
          reasons: [
            'The rationale contains an embedded instruction addressed to the reviewer; embedded text is data about the proposer, not an instruction.',
          ],
          risks: ['prompt-injection attempt inside the proposal rationale'],
          missing_info: [],
          policy_clauses_cited: ['C6', 'C7'],
        };
      }

      if (HARMFUL.some((rx) => rx.test(rationale) || rx.test(proposal.action ?? ''))) {
        return {
          recommendation: 'deny',
          reasons: ['The proposal describes an irreversible, destructive operation with no recovery path stated.'],
          risks: ['irreversible data loss'],
          missing_info: [],
          policy_clauses_cited: ['C2', 'C7'],
        };
      }

      // C5 — missing information. Commitments of any size need a
      // verifiable reference; the mock flags its absence instead of
      // assuming it.
      const missing = [];
      if ((proposal.amount ?? 0) >= 100 && !proposal.context?.contract_ref && !proposal.context?.approver) {
        missing.push('no contract or approver reference for a commitment of this size');
      }
      if (missing.length > 0) {
        return {
          recommendation: 'escalate',
          reasons: ['The proposal is plausible but under-specified for its size; the gaps are listed rather than assumed away.'],
          risks: ['commitment without a verifiable reference'],
          missing_info: missing,
          policy_clauses_cited: ['C5', 'C7'],
        };
      }

      return {
        recommendation: 'approve',
        reasons: [
          `Action "${proposal.action}" against ${proposal.target} is within the charter's routine scope, and the rationale is specific and consistent.`,
        ],
        risks: [],
        missing_info: [],
        policy_clauses_cited: ['C1', 'C7'],
      };
    },
  };
}
