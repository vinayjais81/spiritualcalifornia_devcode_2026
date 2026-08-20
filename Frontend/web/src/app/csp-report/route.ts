import { NextResponse, type NextRequest } from 'next/server';

/**
 * Collector for Content-Security-Policy violation reports.
 *
 * Deliberately at `/csp-report` and **not** `/api/csp-report`: the `/api/*`
 * prefix is routed to NestJS by Nginx on QA and by the load balancer in
 * production, so a report posted there would 404 and we would silently
 * collect nothing. See the `/api/*` collision trap in the deployment plan.
 *
 * Reports are written to the process log, so on QA they surface in
 * `pm2 logs sc-web`. That is enough to tune the policy before switching
 * CSP_MODE to `enforce`; it is not a long-term analytics pipeline.
 */

// Browsers send at most a few KB; anything larger is not a real report.
const MAX_BODY_BYTES = 16_384;

export async function POST(req: NextRequest) {
  try {
    const raw = await req.text();
    if (raw.length > MAX_BODY_BYTES) {
      return new NextResponse(null, { status: 413 });
    }

    const parsed = JSON.parse(raw);

    // Browsers disagree on the envelope: the older `report-uri` sends
    // { "csp-report": {...} }, the newer Reporting API sends an array.
    const report = parsed['csp-report'] ?? parsed;
    const violations = Array.isArray(report) ? report : [report];

    for (const v of violations) {
      const body = v.body ?? v;
      console.warn(
        '[CSP] violation',
        JSON.stringify({
          directive: body['effective-directive'] ?? body.effectiveDirective ?? body['violated-directive'],
          blocked: body['blocked-uri'] ?? body.blockedURL,
          document: body['document-uri'] ?? body.documentURL,
        }),
      );
    }
  } catch {
    // A malformed report is not worth a 500 — the browser has nothing useful
    // to do with the error, and a noisy endpoint invites being hammered.
  }

  // 204: the browser wants no content back.
  return new NextResponse(null, { status: 204 });
}
