// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SearchResultCard } from '@/features/search/components/SearchResultCard';
import type { SearchResultDto } from '@/shared/types';

const base: SearchResultDto = {
  videoId: 'dQw4w9WgXcQ',
  title: 'Blinding Lights',
  channelTitle: 'The Weeknd',
  thumbnailUrl: null,
  durationMs: 213_000,
  viewCount: 1_234_567,
  isLivestream: false,
  embeddable: true,
  addable: true,
};

describe('SearchResultCard', () => {
  it('shows title, channel, duration, views and an Add button for an addable result', () => {
    render(<SearchResultCard result={base} inQueue={false} addState="idle" onAdd={() => {}} />);
    expect(screen.getByText('Blinding Lights')).toBeInTheDocument();
    expect(screen.getByText(/The Weeknd · 3:33 · 1\.2M views/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add blinding lights/i })).toBeInTheDocument();
  });

  it('flags a livestream as Live and offers no Add button', () => {
    render(
      <SearchResultCard
        result={{ ...base, isLivestream: true, addable: false, durationMs: 0 }}
        inQueue={false}
        addState="idle"
        onAdd={() => {}}
      />,
    );
    expect(screen.getByText('Live')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /add/i })).not.toBeInTheDocument();
  });

  it("flags an un-embeddable result as Can't play", () => {
    render(
      <SearchResultCard
        result={{ ...base, embeddable: false, addable: false }}
        inQueue={false}
        addState="idle"
        onAdd={() => {}}
      />,
    );
    expect(screen.getByText(/can't play/i)).toBeInTheDocument();
  });

  it('shows "Add again" when the video is already in the queue', () => {
    render(<SearchResultCard result={base} inQueue addState="idle" onAdd={() => {}} />);
    expect(screen.getByRole('button', { name: /add blinding lights/i })).toHaveTextContent(
      'Add again',
    );
  });

  it('shows an Added badge after a successful add', () => {
    render(<SearchResultCard result={base} inQueue={false} addState="added" onAdd={() => {}} />);
    expect(screen.getByText('Added')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('fires onAdd when the Add button is clicked', () => {
    const onAdd = vi.fn();
    render(<SearchResultCard result={base} inQueue={false} addState="idle" onAdd={onAdd} />);
    screen.getByRole('button', { name: /add blinding lights/i }).click();
    expect(onAdd).toHaveBeenCalledOnce();
  });
});
