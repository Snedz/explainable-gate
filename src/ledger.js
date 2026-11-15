// Append-only JSONL ledger. The class deliberately exposes exactly
// two operations — append() and readAll(). There is no update, no
// delete, no rewrite: an auditor replays decisions from the file
// alone, so history is never edited after the fact.

import fs from 'node:fs';

export class Ledger {
  constructor(filePath) {
    this.filePath = filePath;
  }

  append(entry) {
    const record = {
      seq: this.readAll().length + 1,
      ts: new Date().toISOString(),
      ...entry,
    };
    fs.appendFileSync(this.filePath, JSON.stringify(record) + '\n', 'utf8');
    return record;
  }

  readAll() {
    if (!fs.existsSync(this.filePath)) return [];
    return fs
      .readFileSync(this.filePath, 'utf8')
      .split('\n')
      .filter((line) => line.trim() !== '')
      .map((line) => JSON.parse(line));
  }
}
