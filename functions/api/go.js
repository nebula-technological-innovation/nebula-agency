// Cloudflare Pages implementation of the same fail-closed offer policy as the Vercel adapter.
// No local tunnel, Node runtime, or secret is needed to serve the inquiry-only route.
import { OFFER_DESTINATIONS } from '../../api/_offer-catalog.mjs';
import { commercialRedirectApproved } from '../../api/_commercial-release.mjs';

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const offer = String(url.searchParams.get('offer') || '').trim().toLowerCase();
  const destination = Object.hasOwn(OFFER_DESTINATIONS, offer) ? OFFER_DESTINATIONS[offer] : null;
  if (!destination) return new Response(JSON.stringify({ error: 'unknown_offer' }), {
    status: 404,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }
  });
  if (!(await commercialRedirectApproved(offer, destination, env))) {
    const fallback = new URL('/offers?status=qualification_required', url);
    return new Response(null, { status: 303, headers: {
      Location: fallback.toString(), 'Cache-Control': 'no-store',
      'X-Nebula-Commercial-State': 'release-held'
    }});
  }
  return new Response(null, { status: 302, headers: {
    Location: destination, 'Cache-Control': 'no-store',
    'X-Nebula-Commercial-State': 'owner-approved'
  }});
}
