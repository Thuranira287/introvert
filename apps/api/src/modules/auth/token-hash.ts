import { createHash } from 'crypto';

/** One-way hash used to store refresh and password-reset tokens, so a database leak exposes nothing usable. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
