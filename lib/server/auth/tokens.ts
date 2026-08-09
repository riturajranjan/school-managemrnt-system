// Session token generation & hashing.
//
// The raw token is a 256-bit CSPRNG value handed to the client in an httpOnly
// cookie. Only its SHA-256 hash is stored in the database (Session.tokenHash),
// so a database read never exposes a usable session token.
import { createHash, randomBytes } from "node:crypto";

/** Generate a new opaque session token (URL-safe, 256 bits of entropy). */
export function generateSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Hash a raw session token for storage/lookup (SHA-256 is fine for high-entropy tokens). */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
