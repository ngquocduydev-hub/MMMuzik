'use client';

import { useParams } from 'next/navigation';
import { RoomLayout } from '@/components/RoomLayout';

export default function RoomPage() {
  const params = useParams<{ roomId: string }>();
  const roomId = typeof params.roomId === 'string' ? params.roomId : undefined;
  if (!roomId) return null;
  return <RoomLayout roomId={roomId} />;
}
