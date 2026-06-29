'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Globe, Lock, Plus, Radio } from 'lucide-react';
import { createRoom } from '@/features/room/services/roomApi';
import { ApiError } from '@/lib/http';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

/** Home "Create a room" dialog → POST /api/rooms → /room/[id] as host. */
export function CreateRoomDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [nickname, setNickname] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Give your room a name.');
      return;
    }
    setPending(true);
    setError(null);
    try {
      const { room } = await createRoom({
        name: name.trim(),
        nickname: nickname.trim() || 'Host',
        visibility: isPrivate ? 'private' : 'public',
      });
      router.push(`/room/${room.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't create the room. Try again.");
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
        <Button size="lg" className="w-full gap-2 sm:w-auto">
          <Plus className="h-5 w-5" />
          Create a room
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Radio className="h-5 w-5 text-primary" />
            Create a room
          </DialogTitle>
          <DialogDescription>
            Start a session and invite friends with a link. You&apos;ll be the host.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="room-name">Room name</Label>
            <Input
              id="room-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Friday Vibes"
              maxLength={40}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="host-nickname">Your nickname</Label>
            <Input
              id="host-nickname"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="DJ Duy"
              maxLength={24}
            />
          </div>
          <div className="flex items-start gap-3 rounded-xl border border-border bg-surface/40 p-3">
            <div className="mt-0.5 text-muted-foreground">
              {isPrivate ? <Lock className="h-4 w-4" /> : <Globe className="h-4 w-4" />}
            </div>
            <div className="flex-1">
              <Label htmlFor="room-private" className="cursor-pointer">
                Private room
              </Label>
              <p className="text-xs text-muted-foreground">
                {isPrivate
                  ? 'Hidden from the room list. People join with the code only.'
                  : 'Listed publicly — anyone can find and join it.'}
              </p>
            </div>
            <Switch
              id="room-private"
              checked={isPrivate}
              onCheckedChange={setIsPrivate}
              aria-label="Make this room private"
            />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? 'Creating…' : 'Create & enter room'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
