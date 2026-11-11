#!/usr/bin/env node
// Sets the passphrase that switches on Glitch Pong's admin mode.
//
//   node scripts/set-admin-passphrase.mjs            make a random passphrase
//   node scripts/set-admin-passphrase.mjs "my phrase" use your own
//
// Only a salted PBKDF2 hash is written (into glitchpong-admin.js). The passphrase
// itself is printed once and never stored, so keep it somewhere safe. The site is
// static, so the hash is public: choose something long (the random one has ~75 bits).
import { pbkdf2Sync, randomBytes, randomInt } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const FILE = new URL('../glitchpong-admin.js', import.meta.url);
const ITERATIONS = 150000;
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   // no 0/O/1/I to misread

function randomPassphrase() {
  const group = () => Array.from({ length: 5 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');
  return [group(), group(), group(), group()].join('-');
}

const given = process.argv[2];
const passphrase = (given === undefined ? randomPassphrase() : given).trim();
if (passphrase.length < 10) {
  console.error('Pick a passphrase of at least 10 characters.');
  process.exit(1);
}

const salt = randomBytes(16).toString('hex');
const hash = pbkdf2Sync(passphrase, salt, ITERATIONS, 32, 'sha256').toString('hex');

const source = readFileSync(FILE, 'utf8');
const pattern = /(\/\/ ADMIN-VERIFIER-START[^\n]*\n)[\s\S]*?(\n\s*\/\/ ADMIN-VERIFIER-END)/;
if (!pattern.test(source)) {
  console.error('Could not find the ADMIN-VERIFIER markers in glitchpong-admin.js.');
  process.exit(1);
}
const line = `  const VERIFIER = { salt: "${salt}", iterations: ${ITERATIONS}, hash: "${hash}" };`;
writeFileSync(FILE, source.replace(pattern, `$1${line}$2`));

console.log('Admin passphrase updated in glitchpong-admin.js.');
if (given === undefined) console.log(`\n  PASSPHRASE: ${passphrase}\n\nWrite it down: only its hash is in the code.`);
console.log('Anyone who had admin mode switched on in their browser is switched off by a new passphrase.');
