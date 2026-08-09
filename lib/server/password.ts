// Password hashing — Argon2id via @node-rs/argon2.
//
// Argon2id is the current OWASP-recommended password hashing algorithm. The
// @node-rs binding ships prebuilt native binaries (no node-gyp build step),
// which keeps installs and CI green.
//
// This batch provides hashing only (used by the seed). Login-time verification
// will call `verifyPassword` in a later phase — it is intentionally not wired
// into any request path yet.
import { hash, verify } from "@node-rs/argon2";

// Interactive-login OWASP defaults. @node-rs/argon2 uses Argon2id by default
// (the produced hashes are `$argon2id$…`); the `Algorithm` enum is an ambient
// `const enum` that `isolatedModules` forbids referencing, so we rely on the
// default rather than passing it explicitly.
const ARGON2_OPTIONS = {
  memoryCost: 19456, // 19 MiB
  timeCost: 2,
  parallelism: 1,
} as const;

/** Hash a plaintext password. Returns an Argon2id PHC string (never the plaintext). */
export function hashPassword(plaintext: string): Promise<string> {
  return hash(plaintext, ARGON2_OPTIONS);
}

/** Verify a plaintext password against a stored Argon2id hash. */
export function verifyPassword(storedHash: string, plaintext: string): Promise<boolean> {
  return verify(storedHash, plaintext);
}
