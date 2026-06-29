// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const createRoomMock = vi.fn();
const pushMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn() }),
}));
vi.mock('@/features/room/services/roomApi', () => ({
  createRoom: (input: unknown) => createRoomMock(input),
}));

import { CreateRoomDialog } from '@/components/room/CreateRoomDialog';

beforeEach(() => {
  createRoomMock.mockReset();
  pushMock.mockReset();
  createRoomMock.mockResolvedValue({ room: { id: 'r1' } });
});

function openDialog() {
  fireEvent.click(screen.getByRole('button', { name: /create a room/i }));
}

describe('CreateRoomDialog visibility toggle', () => {
  it('creates a PUBLIC room by default', async () => {
    render(<CreateRoomDialog />);
    openDialog();
    fireEvent.change(screen.getByLabelText(/room name/i), { target: { value: 'Friday Vibes' } });
    fireEvent.click(screen.getByRole('button', { name: /create & enter room/i }));

    await waitFor(() => expect(createRoomMock).toHaveBeenCalledTimes(1));
    expect(createRoomMock).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Friday Vibes', visibility: 'public' }),
    );
  });

  it('creates a PRIVATE room when the toggle is on', async () => {
    render(<CreateRoomDialog />);
    openDialog();
    fireEvent.change(screen.getByLabelText(/room name/i), { target: { value: 'Secret' } });
    fireEvent.click(screen.getByRole('switch', { name: /make this room private/i }));
    fireEvent.click(screen.getByRole('button', { name: /create & enter room/i }));

    await waitFor(() => expect(createRoomMock).toHaveBeenCalledTimes(1));
    expect(createRoomMock).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Secret', visibility: 'private' }),
    );
  });
});
