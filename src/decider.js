// The deterministic decider. Pure function: policy + explanation in,
// decision + rule trace out. No I/O, no randomness, no model calls.
//
// THE INVARIANT: the model's recommendation can only TIGHTEN an
// outcome, never loosen it. Formally, with severity
// approve(0) < escalate(1) < deny(2):
//
//   severity(decision) >= severity(rule floor)
//   severity(decision) >= severity(model recommendation)   [when valid]
//
// where the rule floor is the strictest outcome the deterministic
// rules mandate on their own. A malformed or missing explanation fails
// closed (ESCALATE), unless a deny rule already fired — a deny-listed
// target does not become safer because the model reply was garbled.

import { validateExplanation } from './explainer.js';

const SEVERITY = { approve: 0, escalate: 1, deny: 2 };
const BY_SEVERITY = ['approve', 'escalate', 'deny'];

export function decide({ proposal, explanation, policy }) {
  const trace = [];
  let floor = 'approve';
  let floorRule = null;

  const raise = (level, rule, detail) => {
    trace.push({ rule, level, detail });
    if (SEVERITY[level] > SEVERITY[floor]) {
      floor = level;
      floorRule = rule;
    }
  };

  // Deny lists — code, not prompt. Fire whatever the model says.
  if (policy.deny_targets.includes(proposal.target)) {
    raise('deny', 'deny_list.target', `target "${proposal.target}" is on the deny list`);
  }
  if (policy.deny_actions.includes(proposal.action)) {
    raise('deny', 'deny_list.action', `action "${proposal.action}" is on the deny list`);
  }

  // Caps are arithmetic. Over the hard cap is a denial, full stop.
  if (typeof proposal.amount === 'number' && proposal.amount > policy.hard_cap) {
    raise('deny', 'cap.hard_cap', `amount ${proposal.amount} exceeds hard cap ${policy.hard_cap}`);
  }

  // Prompt-injection scan — deterministic defense in depth alongside
  // charter clause C6. An embedded instruction in the rationale can
  // only ever push a proposal toward a human, never toward approval.
  const rationale = proposal.rationale ?? '';
  const hit = (policy.injection_patterns ?? []).find((p) => new RegExp(p, 'i').test(rationale));
  if (hit) {
    raise('escalate', 'security.injection_pattern', `rationale matched injection pattern /${hit}/i`);
  }

  // Above the human threshold a person decides, even if the model
  // would approve.
  if (typeof proposal.amount === 'number' && proposal.amount > policy.human_threshold) {
    raise('escalate', 'threshold.human_review', `amount ${proposal.amount} exceeds human threshold ${policy.human_threshold}`);
  }

  const check = validateExplanation(explanation);
  if (!check.ok) {
    // Fail closed — unless a deny rule already produced the strictest
    // possible outcome without the model's help.
    if (floor === 'deny') {
      return result('deny', floorRule, trace, null, floor);
    }
    trace.push({
      rule: 'fail_closed.malformed_explanation',
      level: 'escalate',
      detail: `explanation missing or invalid (${check.errors.join('; ') || 'no explanation'})`,
    });
    return result('escalate', 'fail_closed.malformed_explanation', trace, null, floor);
  }

  // Missing information the model itself flagged is a rule-level
  // escalate: a human supplies the fact, then the proposal can return.
  if (explanation.missing_info.length > 0) {
    raise('escalate', 'info.missing_information', `missing: ${explanation.missing_info.join('; ')}`);
  }

  const model = explanation.recommendation;
  const finalLevel = BY_SEVERITY[Math.max(SEVERITY[floor], SEVERITY[model])];
  const ruleFired =
    SEVERITY[model] > SEVERITY[floor] ? 'model.tighten' : (floorRule ?? 'model.recommendation');
  return result(finalLevel, ruleFired, trace, model, floor);
}

function result(level, ruleFired, trace, modelRecommendation, floor) {
  return {
    decision: level.toUpperCase(),
    rule_fired: ruleFired,
    rule_trace: trace,
    model_recommendation: modelRecommendation,
    rule_floor: floor,
  };
}
