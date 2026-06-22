import { describe, it, expect } from 'vitest';
import { extractYouTubeId, isValidYouTubeId } from '@/shared/domain/youtube';

const VID = 'dQw4w9WgXcQ'; // 11 chars

describe('extractYouTubeId', () => {
  it('accepts a bare 11-char id', () => {
    expect(extractYouTubeId(VID)).toBe(VID);
  });
  it('parses watch URLs', () => {
    expect(extractYouTubeId(`https://www.youtube.com/watch?v=${VID}`)).toBe(VID);
    expect(extractYouTubeId(`https://www.youtube.com/watch?v=${VID}&t=42s`)).toBe(VID);
    expect(extractYouTubeId(`https://m.youtube.com/watch?v=${VID}`)).toBe(VID);
    expect(extractYouTubeId(`https://music.youtube.com/watch?v=${VID}`)).toBe(VID);
  });
  it('parses youtu.be / embed / shorts', () => {
    expect(extractYouTubeId(`https://youtu.be/${VID}`)).toBe(VID);
    expect(extractYouTubeId(`https://www.youtube.com/embed/${VID}`)).toBe(VID);
    expect(extractYouTubeId(`https://www.youtube.com/shorts/${VID}`)).toBe(VID);
  });
  it('rejects invalid input', () => {
    expect(extractYouTubeId('')).toBeNull();
    expect(extractYouTubeId('not a video')).toBeNull();
    expect(extractYouTubeId('https://example.com/watch?v=abc')).toBeNull();
    expect(extractYouTubeId('https://www.youtube.com/watch?v=tooShort')).toBeNull();
  });
  it('isValidYouTubeId checks the 11-char shape', () => {
    expect(isValidYouTubeId(VID)).toBe(true);
    expect(isValidYouTubeId('short')).toBe(false);
  });
});
