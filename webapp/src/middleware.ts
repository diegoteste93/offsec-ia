import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const SESSION_COOKIE = 'redamon_session'

const PUBLIC_ROUTES = ['/login', '/api/health', '/api/auth/login']

function isPublicAsset(pathname: string) {
  return /\.[a-zA-Z0-9]+$/.test(pathname)
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (isPublicAsset(pathname)) {
    return NextResponse.next()
  }

  const isPublicRoute = PUBLIC_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`))
  const hasSession = !!request.cookies.get(SESSION_COOKIE)?.value

  if (!hasSession && !isPublicRoute) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const loginUrl = new URL('/login', request.url)
    return NextResponse.redirect(loginUrl)
  }

  if (hasSession && pathname === '/login') {
    return NextResponse.redirect(new URL('/projects', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)']
}
