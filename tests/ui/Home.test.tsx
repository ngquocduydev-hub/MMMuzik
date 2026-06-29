// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// The Create/Join dialogs call useRouter(); there's no App Router in jsdom.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/',
}));

import HomePage from '@/app/page';

describe('HomePage', () => {
  it('renders the hero and the Create/Join room dialog triggers (V1 flow)', () => {
    render(<HomePage />);
    expect(screen.getByText('together')).toBeInTheDocument(); // gradient hero word
    expect(screen.getByRole('button', { name: /create a room/i })).toBeInTheDocument();
    // "Join a room" is now a link to the browse list (was a code dialog).
    expect(screen.getByRole('link', { name: /join a room/i })).toBeInTheDocument();
  });
});
