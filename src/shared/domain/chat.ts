import { CHAT_MAX_LENGTH } from '../constants';

/**
 * Pure chat domain (SPEC §7.11). No infrastructure, no error catalog — the
 * application layer maps the `reason` to the typed `chat.*` error. Kept pure so
 * the validation rules are unit-testable without a transport or a clock.
 */
export type MessageBodyRejection = 'empty' | 'too_long';

export type MessageBodyResult =
  | { ok: true; body: string }
  | { ok: false; reason: MessageBodyRejection };

/** Collapse surrounding whitespace; the on-the-wire body is always trimmed. */
export function normalizeMessageBody(raw: string): string {
  return raw.trim();
}

/**
 * Validate a raw chat body: reject blank (REQ-CHAT-4) and over-long messages
 * (> CHAT_MAX_LENGTH). On success returns the normalized body to persist.
 */
export function validateMessageBody(raw: string): MessageBodyResult {
  const body = normalizeMessageBody(raw);
  if (body.length === 0) return { ok: false, reason: 'empty' };
  if (body.length > CHAT_MAX_LENGTH) return { ok: false, reason: 'too_long' };
  return { ok: true, body };
}
