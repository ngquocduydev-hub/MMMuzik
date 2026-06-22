'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { getRoomSummary, joinRoom } from '@/features/room/services/roomApi';
import { ApiError } from '@/lib/http';
import type { RoomSummaryDto } from '@/shared/types';
import { Logo } from '@/components/layout/Logo';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/feedback/Spinner';
import { RoomInfoCard } from './RoomInfoCard';
import { NicknameForm } from './NicknameForm';

/**
 * Invite/join landing (/join/[code]). Loads the room summary, then captures a
 * nickname and joins via the existing REST flow (which sets the session cookie),
 * routing to /room/[id]. Closed/unknown codes show a recoverable error.
 */
export function JoinRoomPanel({ code }: { code: string }) {
  const router = useRouter();
  const [summary, setSummary] = useState<RoomSummaryDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    getRoomSummary(code)
      .then((res) => active && setSummary(res.summary))
      .catch(
        (err) =>
          active &&
          setLoadError(err instanceof ApiError ? err.message : 'Could not load the room.'),
      )
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [code]);

  const join = async (nickname: string) => {
    setJoining(true);
    setJoinError(null);
    try {
      const { room } = await joinRoom({ code, nickname });
      router.push(`/room/${room.id}`);
    } catch (err) {
      setJoinError(err instanceof ApiError ? err.message : 'Could not join the room.');
      setJoining(false);
    }
  };

  return (
    <main className="bg-aurora flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className="mb-8">
        <Logo href="/" size="md" />
      </div>
      <div className="w-full max-w-md space-y-5">
        {loading ? (
          <div className="surface-panel flex items-center justify-center gap-3 p-10 text-sm text-muted-foreground">
            <Spinner /> Looking up the room…
          </div>
        ) : loadError || !summary ? (
          <div className="surface-panel flex flex-col items-center gap-3 p-8 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/15 text-destructive">
              <AlertTriangle className="h-6 w-6" />
            </span>
            <h1 className="text-lg font-semibold text-foreground">Room not found</h1>
            <p className="text-sm text-muted-foreground">
              {loadError ?? "This room doesn't exist or has closed."}
            </p>
            <Button asChild variant="secondary">
              <Link href="/">Back to Home</Link>
            </Button>
          </div>
        ) : (
          <>
            <RoomInfoCard summary={summary} />
            <div className="surface-panel p-5">
              <NicknameForm onSubmit={join} isSubmitting={joining} error={joinError} />
            </div>
            <p className="text-center text-xs text-muted-foreground">
              No account needed — your nickname is your identity in the room.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
