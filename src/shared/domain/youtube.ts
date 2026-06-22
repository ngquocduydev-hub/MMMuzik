/**
 * Pure YouTube id extraction — shared by the client (host input) and the server
 * (loadVideo validation). Accepts a bare 11-char id or common YouTube URL forms.
 */
const ID_RE = /^[A-Za-z0-9_-]{11}$/;

export function extractYouTubeId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (ID_RE.test(trimmed)) return trimmed;

  try {
    const url = new URL(trimmed);
    const host = url.hostname.replace(/^www\./, '');
    if (host === 'youtu.be') {
      const id = url.pathname.slice(1).split('/')[0] ?? '';
      return ID_RE.test(id) ? id : null;
    }
    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
      const v = url.searchParams.get('v');
      if (v && ID_RE.test(v)) return v;
      // /embed/<id>, /shorts/<id>, /v/<id>
      const m = url.pathname.match(/\/(embed|shorts|v)\/([A-Za-z0-9_-]{11})/);
      if (m) return m[2] ?? null;
    }
  } catch {
    /* not a URL */
  }
  return null;
}

export function isValidYouTubeId(id: string): boolean {
  return ID_RE.test(id);
}
