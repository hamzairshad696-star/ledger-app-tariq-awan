import { NextResponse } from 'next/server';
import { SESSION_COOKIE, verifySession } from './lib/session';

// First line of defence for pages. Every API route re-checks the user and role
// against the database, so hiding pages is never the only protection.
export async function middleware(req) {
  const { pathname } = req.nextUrl;
  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  const role = session?.role;
  const home = role === 'admin' ? '/admin' : role === 'viewer' ? '/viewer' : '/login';

  if (pathname === '/' || pathname === '/login') {
    if (role) return NextResponse.redirect(new URL(home, req.url));
    return pathname === '/' ? NextResponse.redirect(new URL('/login', req.url)) : NextResponse.next();
  }
  if (pathname.startsWith('/admin') && role !== 'admin') return NextResponse.redirect(new URL(role ? home : '/login', req.url));
  if (pathname.startsWith('/viewer') && role !== 'viewer') return NextResponse.redirect(new URL(role ? home : '/login', req.url));
  return NextResponse.next();
}

export const config = { matcher: ['/', '/login', '/admin/:path*', '/viewer/:path*'] };
