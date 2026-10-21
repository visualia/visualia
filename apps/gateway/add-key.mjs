// Create a course key for a person and print the SQL to store its hash.
// Usage: node add-key.mjs <person_id> [school_id] [role]
// Then run the printed command. The key itself is shown once and never stored.
import { createHash, randomBytes } from 'node:crypto';

const [person, school = 'eka', role = 'student'] = process.argv.slice(2);
if (!person) {
  console.error('usage: node add-key.mjs <person_id> [school_id] [role]');
  process.exit(1);
}
const key = `vk_${school}_${randomBytes(24).toString('base64url')}`;
const hash = createHash('sha256').update(key).digest('hex');
const sql = [
  `INSERT OR IGNORE INTO schools (id, name) VALUES ('${school}', '${school}');`,
  `INSERT OR IGNORE INTO people (id, school_id, role) VALUES ('${person}', '${school}', '${role}');`,
  `INSERT INTO keys (hash, person_id) VALUES ('${hash}', '${person}');`,
].join(' ');
console.log(`key (shown once): ${key}`);
console.log(`npx wrangler d1 execute visualia-ledger --remote --command "${sql}"`);
