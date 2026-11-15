// Boundary validation for incoming proposals. Anything that does not
// match the proposal shape is rejected before it can reach the
// explainer, the decider, or the ledger.

const REQUIRED_STRINGS = ['actor', 'action', 'target', 'rationale'];

export function validateProposal(raw) {
  const errors = [];
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, errors: ['proposal must be a JSON object'] };
  }

  const proposal = {};
  if (raw.id !== undefined) {
    if (typeof raw.id !== 'string' || raw.id.trim() === '') {
      errors.push('id must be a non-empty string when present');
    } else {
      proposal.id = raw.id.trim();
    }
  }
  for (const field of REQUIRED_STRINGS) {
    if (typeof raw[field] !== 'string' || raw[field].trim() === '') {
      errors.push(`${field} is required and must be a non-empty string`);
    } else {
      proposal[field] = raw[field].trim();
    }
  }
  if (raw.amount !== undefined) {
    if (typeof raw.amount !== 'number' || !Number.isFinite(raw.amount) || raw.amount < 0) {
      errors.push('amount must be a finite number >= 0 when present');
    } else {
      proposal.amount = raw.amount;
    }
  }
  if (raw.context !== undefined) {
    if (raw.context === null || typeof raw.context !== 'object' || Array.isArray(raw.context)) {
      errors.push('context must be an object when present');
    } else {
      proposal.context = raw.context;
    }
  }

  if (errors.length > 0) return { ok: false, errors };
  if (!proposal.id) {
    proposal.id = `p-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
  }
  return { ok: true, errors: [], proposal };
}
