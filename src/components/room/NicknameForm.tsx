'use client';

import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

/** Single nickname field (autofocus, Enter submits) — the only join friction. */
export function NicknameForm({
  onSubmit,
  isSubmitting,
  error,
}: {
  onSubmit: (nickname: string) => void;
  isSubmitting: boolean;
  error: string | null;
}) {
  const [nickname, setNickname] = useState('');

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (nickname.trim() && !isSubmitting) onSubmit(nickname.trim());
      }}
      className="space-y-3"
    >
      <div className="space-y-2">
        <Label htmlFor="nickname">Your nickname</Label>
        <Input
          id="nickname"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="Pick a name to join as"
          maxLength={24}
          autoFocus
          aria-invalid={!!error}
          aria-describedby={error ? 'nickname-error' : undefined}
        />
        {error && (
          <p id="nickname-error" className="text-xs text-destructive">
            {error}
          </p>
        )}
      </div>
      <Button
        type="submit"
        size="lg"
        className="w-full gap-2"
        disabled={isSubmitting || !nickname.trim()}
      >
        {isSubmitting ? (
          'Joining…'
        ) : (
          <>
            Join Room
            <ArrowRight className="h-4 w-4" />
          </>
        )}
      </Button>
    </form>
  );
}
