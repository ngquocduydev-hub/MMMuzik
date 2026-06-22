import type { Metadata } from 'next';
import { JoinRoomPanel } from '@/components/room/JoinRoomPanel';

export const metadata: Metadata = { title: 'Join a room · MMMuzik' };

/** /join/[code] — invite target: room summary + nickname capture. */
export default async function JoinByCodePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <JoinRoomPanel code={code} />;
}
