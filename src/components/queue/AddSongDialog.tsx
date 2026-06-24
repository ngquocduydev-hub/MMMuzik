'use client';

import { useState } from 'react';
import { Plus, ListPlus, Link2 } from 'lucide-react';
import { toast } from 'sonner';
import { getSocket } from '@/lib/socket-client';
import { useRoomStore } from '@/features/room/store';
import { useActivityPing } from '@/features/queue/activityStore';
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

/**
 * Add a track to the shared queue — any participant (V1 §7.6). Submits the raw
 * link over the existing `queue:add` socket command; the server resolves +
 * validates + broadcasts the updated queue. Inline error on rejection; toast on
 * success.
 */
export function AddSongDialog() {
  const roomId = useRoomStore((s) => s.room?.id ?? null);
  const pingActivity = useActivityPing();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const reset = () => {
    setValue('');
    setError(null);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const url = value.trim();
    if (!roomId || !url || adding) return;
    setError(null);
    setAdding(true);
    pingActivity(roomId); // let others see "X is adding a song…"
    getSocket().emit('queue:add', { roomId, urlOrId: url }, (res) => {
      setAdding(false);
      if (res.success) {
        toast.success('Added to the queue');
        setValue('');
        setOpen(false);
      } else {
        setError(res.message);
      }
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" />
          Add song
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ListPlus className="h-5 w-5 text-primary" />
            Add a song
          </DialogTitle>
          <DialogDescription>
            Paste a YouTube or Spotify link. It’ll be added to the end of the queue for everyone.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="track-url">Song link</Label>
            <div className="relative">
              <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="track-url"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="https://youtube.com/watch?v=…  or  open.spotify.com/track/…"
                autoFocus
                className="pl-9"
                aria-invalid={!!error}
                aria-describedby={error ? 'track-url-error' : undefined}
              />
            </div>
            {error && (
              <p id="track-url-error" className="text-xs text-destructive">
                {error}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!value.trim() || adding}>
              {adding ? 'Adding…' : 'Add to queue'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
