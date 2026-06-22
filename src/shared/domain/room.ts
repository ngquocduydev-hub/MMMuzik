import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from '../constants';

/**
 * Pure room helpers — code generation, nickname de-duplication, host check.
 * Randomness is injected so generation is deterministic in tests.
 */
export function generateRoomCode(
  rand: () => number = Math.random,
  length: number = ROOM_CODE_LENGTH,
  alphabet: string = ROOM_CODE_ALPHABET,
): string {
  let code = '';
  for (let i = 0; i < length; i++) {
    code += alphabet[Math.floor(rand() * alphabet.length)];
  }
  return code;
}

/** Append a numeric suffix on collision: `Duy`, `Duy (2)`, `Duy (3)` (FR-2.4). */
export function dedupeNickname(desired: string, existing: readonly string[]): string {
  const taken = new Set(existing);
  if (!taken.has(desired)) return desired;
  let n = 2;
  while (taken.has(`${desired} (${n})`)) n++;
  return `${desired} (${n})`;
}

export function isHost(room: { hostSessionId: string }, sessionId: string | null): boolean {
  return sessionId !== null && room.hostSessionId === sessionId;
}
