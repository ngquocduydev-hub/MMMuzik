'use client';

import { useState } from 'react';
import { SendHorizonal } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { CHAT_MAX_LENGTH } from '@/shared/constants';

/**
 * Chat composer. Enter-to-send (form submit); send disabled when empty/sending.
 * `onSend` returns whether the send succeeded so the field clears only on success
 * (keeps V2's ack-confirmed behaviour); on failure the parent surfaces the error.
 */
export function MessageInput({
  onSend,
  disabled,
}: {
  onSend: (text: string) => Promise<boolean>;
  disabled?: boolean;
}) {
  const [value, setValue] = useState('');
  const [sending, setSending] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = value.trim();
    if (!text || sending || disabled) return;
    setSending(true);
    const ok = await onSend(text);
    setSending(false);
    if (ok) setValue('');
  };

  return (
    <form
      onSubmit={submit}
      className="flex shrink-0 items-center gap-2 border-t border-border/60 p-3"
    >
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Message the room…"
        aria-label="Message"
        autoComplete="off"
        maxLength={CHAT_MAX_LENGTH}
        disabled={disabled}
        className="h-10"
      />
      <Button
        type="submit"
        size="icon"
        aria-label="Send message"
        disabled={!value.trim() || sending}
      >
        <SendHorizonal className="h-4 w-4" />
      </Button>
    </form>
  );
}
