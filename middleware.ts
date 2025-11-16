import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';

// Public routes that don't require authentication
const publicRoutes = ['/auth/signin', '/auth/error', '/auth/reset-password'];

// Route permissions by role
const rolePermissions = {
  shareholder: ['/dashboard', '/documents', '/profile', '/cap-table'],
  board_member: ['/dashboard', '/documents', '/profile', '/cap-table', '/shareholders', '/admin'],
  admin_view: ['/dashboard', '/documents', '/profile', '/cap-table', '/shareholders', '/admin'],
  admin_edit: ['/dashboard', '/documents', '/profile', '/cap-table', '/shareholders', '/admin', '/admin/upload', '/admin/shareholders/new'],
};

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes
  if (publicRoutes.some(route => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Allow API routes and static files
  if (pathname.startsWith('/api') || pathname.startsWith('/_next') || pathname.startsWith('/favicon')) {
    return NextResponse.next();
  }

  // Check authentication
  const session = await auth();

  if (!session?.user) {
    const signInUrl = new URL('/auth/signin', request.url);
    signInUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(signInUrl);
  }

  // Check role permissions
  const userRole = session.user.role;
  const allowedRoutes = rolePermissions[userRole as keyof typeof rolePermissions] || [];

  const hasAccess = allowedRoutes.some(route => pathname.startsWith(route)) || pathname === '/';

  if (!hasAccess) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
