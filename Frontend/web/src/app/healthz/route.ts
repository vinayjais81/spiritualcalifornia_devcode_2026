import { NextResponse } from 'next/server';

/**
 * Liveness probe for the Next.js process — what the ALB's web target group
 * polls.
 *
 * Using `/` for this instead would cost a full React render of the home page
 * on every check, on every instance, every 30 seconds. This route renders
 * nothing and touches no dependency: it answers only "is this process
 * serving?", which is the single question a target group needs answered.
 *
 * force-dynamic keeps it out of the static prerender — a cached 200 would
 * keep reporting health after the process behind it had stopped being able
 * to serve anything.
 */
export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json({
    status: 'ok',
    uptimeSeconds: Math.round(process.uptime()),
  });
}
