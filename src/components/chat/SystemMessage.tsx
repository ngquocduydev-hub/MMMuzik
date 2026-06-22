/** Centered system chip in the chat stream — joins, leaves, host transfers (V1 §5.12). */
export function SystemMessage({ text }: { text: string }) {
  return (
    <div className="flex justify-center">
      <span className="rounded-full bg-surface-2 px-3 py-1 text-xs text-muted-foreground">
        {text}
      </span>
    </div>
  );
}
