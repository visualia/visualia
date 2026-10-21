// Create a course key for a person and print the SQL to store its hash.
// Usage: node add-key.mjs <person_id> [school_id] [role]
// Keys are two groups of four uppercase letters (no I or O), e.g. KMRT-WABE:
// readable aloud, typeable, ~37 bits; sign-in and gateway are rate-limited. Case, dashes and spaces don't matter when
// typed. The key is shown once and never stored, only its hash.
import { createHash, randomInt } from 'node:crypto';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I, no O
export const normalizeKey = (k) => k.toUpperCase().replace(/[^A-Z]/g, '');

const [person, school = 'eka', role = 'student'] = process.argv.slice(2);
if (!person) {
  console.error('usage: node add-key.mjs <person_id> [school_id] [role]');
  process.exit(1);
}
const letters = Array.from({ length: 8 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');
const key = letters.match(/.{4}/g).join('-');
const hash = createHash('sha256').update(normalizeKey(key)).digest('hex');
const sql = [
  `INSERT OR IGNORE INTO schools (id, name) VALUES ('${school}', '${school}');`,
  `INSERT OR IGNORE INTO people (id, school_id, role) VALUES ('${person}', '${school}', '${role}');`,
  `INSERT INTO keys (hash, person_id) VALUES ('${hash}', '${person}');`,
].join(' ');
console.log(`key (shown once): ${key}`);
console.log(`npx wrangler d1 execute visualia --remote --command "${sql}"`);
