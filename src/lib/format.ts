/** Display formatters shared by the playback + queue UI (display-only). */

/** ms → `m:ss`. */
export function formatMs(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Queue-row time readout. The currently-playing track shows `position / duration`
 * (e.g. `11:11 / 27:33`); every other row shows the duration alone (`27:33`).
 * `positionMs` is the server-authoritative live position for the current track, or
 * `null` for a non-current row. Position is clamped to the duration so it never
 * over-runs the total (`27:33 / 27:33` at the end). When the duration is still
 * unknown (0, before the host reports it) we show the live elapsed alone for the
 * current track, and `--:--` for others.
 */
export function formatTrackTime(positionMs: number | null, durationMs: number): string {
  const duration = durationMs > 0 ? formatMs(durationMs) : null;
  if (positionMs == null) return duration ?? '--:--'; // not the current track → duration only
  const clamped = durationMs > 0 ? Math.min(positionMs, durationMs) : positionMs;
  const position = formatMs(clamped);
  return duration ? `${position} / ${duration}` : position;
}

/**
 * Best-effort "Song — Artist" split from a YouTube title (the wire DTO carries
 * only `title`). Display-only, never used for logic.
 * "The Weeknd - Blinding Lights" → { primary: 'Blinding Lights', secondary: 'The Weeknd' }.
 */
export function splitTrackTitle(title: string): { primary: string; secondary: string | null } {
  const idx = title.indexOf(' - ');
  if (idx > 0)
    return { primary: title.slice(idx + 3).trim(), secondary: title.slice(0, idx).trim() };
  return { primary: title, secondary: null };
}

/** ISO timestamp → `HH:MM` in the viewer's locale (chat message time). */
export function formatClock(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
