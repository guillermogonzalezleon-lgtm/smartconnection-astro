import { defineMiddleware } from 'astro:middleware';
import { verifySession } from './pages/api/auth';

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;

  // Protect intranet routes
  if (pathname.startsWith('/intranet')) {
    // Allow the login page itself
    if (pathname === '/intranet' || pathname === '/intranet/') {
      return next();
    }

    const session = verifySession(context.cookies.get('sc_session')?.value);
    if (!session.valid) {
      return context.redirect('/intranet');
    }
  }

  // Protect API routes that need auth (agents)
  if (pathname === '/api/agents') {
    // Auth is checked inside the endpoint, just pass through
    return next();
  }

  return next();
});
