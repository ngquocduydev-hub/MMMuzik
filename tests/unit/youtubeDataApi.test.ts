import { describe, it, expect } from 'vitest';
import {
  parseIso8601DurationMs,
  classifyVideoItem,
  toSearchResult,
} from '@/server/services/youtubeDataApi';

const VID = 'dQw4w9WgXcQ';

describe('parseIso8601DurationMs', () => {
  it('parses minutes + seconds', () => {
    expect(parseIso8601DurationMs('PT3M33S')).toBe(213_000);
  });
  it('parses hours + minutes + seconds', () => {
    expect(parseIso8601DurationMs('PT1H2M3S')).toBe((3600 + 120 + 3) * 1000);
  });
  it('parses seconds only', () => {
    expect(parseIso8601DurationMs('PT45S')).toBe(45_000);
  });
  it('treats P0D / empty / garbage as 0 (livestream markers)', () => {
    expect(parseIso8601DurationMs('P0D')).toBe(0);
    expect(parseIso8601DurationMs('')).toBe(0);
    expect(parseIso8601DurationMs('not-a-duration')).toBe(0);
  });
});

describe('classifyVideoItem', () => {
  it('classifies a normal embeddable VOD', () => {
    const d = classifyVideoItem(
      {
        snippet: { title: 'Song', liveBroadcastContent: 'none' },
        contentDetails: { duration: 'PT3M33S' },
        status: { embeddable: true, privacyStatus: 'public' },
      },
      VID,
    );
    expect(d).toMatchObject({
      exists: true,
      isLivestream: false,
      embeddable: true,
      durationMs: 213_000,
    });
    expect(d.title).toBe('Song');
  });

  it('flags a live broadcast as a livestream (duration zeroed)', () => {
    const d = classifyVideoItem(
      {
        snippet: { title: 'Lo-fi radio', liveBroadcastContent: 'live' },
        contentDetails: { duration: 'P0D' },
        status: { embeddable: true, privacyStatus: 'public' },
      },
      VID,
    );
    expect(d.isLivestream).toBe(true);
    expect(d.durationMs).toBe(0);
  });

  it('flags an upcoming premiere as a livestream', () => {
    const d = classifyVideoItem(
      {
        snippet: { liveBroadcastContent: 'upcoming' },
        contentDetails: { duration: 'P0D' },
        status: { embeddable: true },
      },
      VID,
    );
    expect(d.isLivestream).toBe(true);
  });

  it('treats a zero-duration VOD as a livestream (engine can not handle it)', () => {
    const d = classifyVideoItem(
      {
        snippet: { liveBroadcastContent: 'none' },
        contentDetails: { duration: 'P0D' },
        status: { embeddable: true },
      },
      VID,
    );
    expect(d.isLivestream).toBe(true);
  });

  it('marks embeddable=false when embedding is disabled', () => {
    const d = classifyVideoItem(
      {
        snippet: { liveBroadcastContent: 'none' },
        contentDetails: { duration: 'PT3M' },
        status: { embeddable: false },
      },
      VID,
    );
    expect(d.embeddable).toBe(false);
  });

  it('marks embeddable=false for a private video', () => {
    const d = classifyVideoItem(
      {
        snippet: { liveBroadcastContent: 'none' },
        contentDetails: { duration: 'PT3M' },
        status: { embeddable: true, privacyStatus: 'private' },
      },
      VID,
    );
    expect(d.embeddable).toBe(false);
  });

  it('falls back to the canonical thumbnail when none provided', () => {
    const d = classifyVideoItem(
      {
        snippet: { liveBroadcastContent: 'none' },
        contentDetails: { duration: 'PT1M' },
        status: { embeddable: true },
      },
      VID,
    );
    expect(d.thumbnailUrl).toBe(`https://i.ytimg.com/vi/${VID}/hqdefault.jpg`);
  });
});

describe('toSearchResult', () => {
  it('maps an embeddable VOD to an addable result with view count + channel', () => {
    const r = toSearchResult({
      id: VID,
      snippet: { title: 'Song', channelTitle: 'Official Artist', liveBroadcastContent: 'none' },
      contentDetails: { duration: 'PT3M33S' },
      status: { embeddable: true, privacyStatus: 'public' },
      statistics: { viewCount: '1234567' },
    });
    expect(r).toMatchObject({
      videoId: VID,
      title: 'Song',
      channelTitle: 'Official Artist',
      durationMs: 213_000,
      viewCount: 1_234_567,
      isLivestream: false,
      embeddable: true,
      addable: true,
    });
  });

  it('marks a livestream not addable', () => {
    const r = toSearchResult({
      id: VID,
      snippet: { title: 'Lo-fi', channelTitle: 'Beats', liveBroadcastContent: 'live' },
      contentDetails: { duration: 'P0D' },
      status: { embeddable: true, privacyStatus: 'public' },
    });
    expect(r.isLivestream).toBe(true);
    expect(r.addable).toBe(false);
  });

  it('marks an un-embeddable video not addable', () => {
    const r = toSearchResult({
      id: VID,
      snippet: { title: 'Blocked', channelTitle: 'Label', liveBroadcastContent: 'none' },
      contentDetails: { duration: 'PT4M' },
      status: { embeddable: false, privacyStatus: 'public' },
    });
    expect(r.addable).toBe(false);
  });

  it('returns null viewCount when statistics are absent', () => {
    const r = toSearchResult({
      id: VID,
      snippet: { title: 'X', channelTitle: 'Y', liveBroadcastContent: 'none' },
      contentDetails: { duration: 'PT2M' },
      status: { embeddable: true },
    });
    expect(r.viewCount).toBeNull();
  });
});
