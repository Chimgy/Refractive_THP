import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

// AES-256-GCM, not the one-way hash visitor-hash.util.ts uses elsewhere in
// this module — a Cloudflare API token has to be recovered in full to
// authenticate against Cloudflare's GraphQL Analytics API
// (telemetry-cloudflare-pull.processor.ts), so hashing it isn't an option.
// Key comes from CLOUDFLARE_TOKEN_ENC_KEY (32 raw bytes, base64), same
// provisioning precedent as TELEMETRY_HASH_SECRET — read via ConfigService
// by the caller, not by this file, matching visitor-hash.util.ts's shape
// (the secret is a parameter here, not something this module reads itself).
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH_BYTES = 12; // standard GCM nonce size

export type EncryptedToken = {
  ciphertext: string; // base64: encrypted bytes + auth tag, appended
  iv: string; // base64
};

export function encryptCloudflareToken(
  key: Buffer,
  token: string,
): EncryptedToken {
  const iv = randomBytes(IV_LENGTH_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(token, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return {
    ciphertext: Buffer.concat([encrypted, authTag]).toString('base64'),
    iv: iv.toString('base64'),
  };
}

export function decryptCloudflareToken(
  key: Buffer,
  ciphertext: string,
  iv: string,
): string {
  const combined = Buffer.from(ciphertext, 'base64');
  // Auth tag is always the trailing 16 bytes GCM produces, same layout
  // encryptCloudflareToken above appended it in.
  const authTag = combined.subarray(combined.length - 16);
  const encrypted = combined.subarray(0, combined.length - 16);
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(iv, 'base64'));
  decipher.setAuthTag(authTag);
  return Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]).toString('utf8');
}
