'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogIn } from 'lucide-react';
import { getRoomSummary } from '@/features/room/services/roomApi';
import { ApiError } from '@/lib/http';
import { formatRoomCode, cleanRoomCode } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

/** Home "Join a room" dialog → validate code → /join/[code] (nickname step). */
export function JoinRoomDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const clean = cleanRoomCode(code);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (clean.length < 6) {
      setError('Enter a valid room code.');
      return;
    }
    setPending(true);
    setError(null);
    try {
      await getRoomSummary(clean); // validate before navigating
      router.push(`/join/${clean}`);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Couldn’t reach the server — check your connection.',
      );
      setPending(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setError(null);
      }}
    >
      <DialogTrigger asChild>
        <Button size="lg" variant="secondary" className="w-full gap-2 sm:w-auto">
          <LogIn className="h-5 w-5" />
          Join a room
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LogIn className="h-5 w-5 text-primary" />
            Join a room
          </DialogTitle>
          <DialogDescription>Enter the room code a friend shared with you.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="join-code">Room code</Label>
            <Input
              id="join-code"
              value={code}
              onChange={(e) => setCode(formatRoomCode(e.target.value))}
              placeholder="7QK-2MD"
              autoFocus
              className="text-center text-lg tracking-[0.3em]"
              aria-invalid={!!error}
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button type="submit" className="w-full" disabled={pending || clean.length < 6}>
              {pending ? 'Checking…' : 'Continue'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
