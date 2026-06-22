import { NextResponse } from 'next/server';
import { getHealth } from '@/lib/health';

/**
 * GET /api/health — liveness/readiness probe.
 *
 * Verifies PostgreSQL and Redis connectivity (your Phase 1 requirement).
 * Returns `{ "status": "healthy" }` (200) when both are reachable, otherwise
 * `{ "status": "unhealthy", "checks": { ... } }` (503).
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  const { healthy, checks } = await getHealth();

  if (healthy) {
    return NextResponse.json({ status: 'healthy' });
  }

  return NextResponse.json({ status: 'unhealthy', checks }, { status: 503 });
}
