export const prerender = false;

import type { APIRoute } from 'astro';
import { trackEvent } from '../../lib/analytics';

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    await trackEvent({
      event: body.event,
      page: body.page,
      source: body.source,
      medium: body.medium,
      campaign: body.campaign,
      term: body.term,
      content: body.content,
      referrer: body.referrer,
      lang: body.lang,
      userAgent: request.headers.get('user-agent') || undefined,
    });
    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch {
    return new Response(JSON.stringify({ success: false }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
};
