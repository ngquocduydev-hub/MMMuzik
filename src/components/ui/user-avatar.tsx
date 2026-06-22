import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn, avatarGradient, initials } from '@/lib/utils';

/**
 * App avatar: a shadcn `Avatar` with a deterministic gradient + initials fallback
 * (guests have no uploaded image). Same person → same gradient everywhere
 * (participants, chat, header). `seed` keys the colour (sessionId preferred,
 * else the name).
 */
const SIZES = {
  sm: 'h-7 w-7 text-[10px]',
  md: 'h-9 w-9 text-xs',
  lg: 'h-11 w-11 text-sm',
} as const;

export function UserAvatar({
  name,
  src,
  seed,
  size = 'md',
  className,
}: {
  name: string;
  src?: string | null;
  seed?: string;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  return (
    <Avatar className={cn(SIZES[size], className)}>
      {src ? <AvatarImage src={src} alt={name} /> : null}
      <AvatarFallback
        className={cn('bg-gradient-to-br font-semibold text-white', avatarGradient(seed ?? name))}
      >
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
