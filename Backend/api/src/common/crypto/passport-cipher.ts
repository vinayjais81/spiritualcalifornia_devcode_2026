import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

/**
 * AES-256-GCM cipher for passport numbers and other sensitive PII.
 *
 * Storage format (single string column):
 *   "v1:<iv_b64>:<authTag_b64>:<ciphertext_b64>"
 *
 * Key source: PASSPORT_ENCRYPTION_KEY env var.
 *   - Must be 64 hex characters (32 bytes / 256 bits)
 *   - Generate one with: `openssl rand -hex 32`
 *
 * Key rotation: future-proofed via the "v1:" prefix. Add "v2" handler when
 * rotating; both versions can coexist during the rollover window.
 */

const VERSION = 'v1';
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // GCM standard
const AUTH_TAG_LENGTH = 16;

let cachedKey: Buffer | null = null;

/**
 * Read PASSPORT_ENCRYPTION_KEY directly from the .env file on disk.
 * Used as a fallback when the running process was started before the env
 * var was added (so process.env doesn't have it yet) — avoids forcing a
 * full backend restart for a config change.
 */
function readKeyFromEnvFile(): string | undefined {
  // Walk up from the compiled file location looking for a .env
  // (works whether the code is at src/... in dev or dist/... in prod build)
  const candidates = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(__dirname, '../../../.env'),
    path.resolve(__dirname, '../../../../.env'),
  ];
  for (const p of candidates) {
    try {
      if (!fs.existsSync(p)) continue;
      const content = fs.readFileSync(p, 'utf8');
      for (const rawLine of content.split('\n')) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#')) continue;
        const eq = line.indexOf('=');
        if (eq === -1) continue;
        const key = line.slice(0, eq).trim();
        if (key !== 'PASSPORT_ENCRYPTION_KEY') continue;
        // Strip optional surrounding quotes
        let value = line.slice(eq + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        return value;
      }
    } catch {
      // Try next candidate
    }
  }
  return undefined;
}

function getKey(): Buffer {
  if (cachedKey) return cachedKey;
  // 1. Prefer process.env (NestJS ConfigModule loads it on startup)
  // 2. Fall back to reading .env directly (handles "added env after process started")
  let hex = process.env.PASSPORT_ENCRYPTION_KEY;
  if (!hex) {
    hex = readKeyFromEnvFile();
    if (hex) {
      process.env.PASSPORT_ENCRYPTION_KEY = hex; // hydrate for subsequent calls
    }
  }
  if (!hex) {
    throw new Error(
      'PASSPORT_ENCRYPTION_KEY env var is not set. Generate one with: openssl rand -hex 32',
    );
  }
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error(
      'PASSPORT_ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes / 256 bits)',
    );
  }
  cachedKey = Buffer.from(hex, 'hex');
  return cachedKey;
}

/**
 * Encrypt a plaintext string. Returns the storage-format string.
 */
export function encryptPassport(plaintext: string): string {
  if (plaintext == null || plaintext === '') {
    throw new Error('Cannot encrypt empty passport value');
  }
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [
    VERSION,
    iv.toString('base64'),
    authTag.toString('base64'),
    enc.toString('base64'),
  ].join(':');
}

/**
 * Decrypt a stored ciphertext. Throws if the auth tag fails (tampering / wrong key).
 */
export function decryptPassport(stored: string): string {
  if (!stored) throw new Error('Cannot decrypt empty value');
  const parts = stored.split(':');
  if (parts.length !== 4) {
    throw new Error('Invalid encrypted passport format');
  }
  const [version, ivB64, tagB64, ctB64] = parts;
  if (version !== VERSION) {
    throw new Error(`Unsupported passport cipher version: ${version}`);
  }
  const key = getKey();
  const iv = Buffer.from(ivB64, 'base64');
  const authTag = Buffer.from(tagB64, 'base64');
  const ct = Buffer.from(ctB64, 'base64');
  if (authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error('Invalid auth tag length');
  }
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const dec = Buffer.concat([decipher.update(ct), decipher.final()]);
  return dec.toString('utf8');
}

/**
 * Mask a passport for display: show last 4 chars only ("•••••5678").
 * Used in lists where the full number is not needed.
 */
export function maskPassport(plaintext: string): string {
  if (!plaintext) return '';
  if (plaintext.length <= 4) return '•'.repeat(plaintext.length);
  return '•'.repeat(plaintext.length - 4) + plaintext.slice(-4);
}
