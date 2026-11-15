// Loads the deterministic policy and the versioned charter text.
// policy.json is the enforcing source of truth; the charter mirrors it
// in prose for the model.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

export function loadPolicy() {
  return JSON.parse(fs.readFileSync(path.join(ROOT, 'policy.json'), 'utf8'));
}

export function loadCharter() {
  return fs.readFileSync(path.join(ROOT, 'prompts', 'charter.v1.md'), 'utf8');
}

export function rootDir() {
  return ROOT;
}
