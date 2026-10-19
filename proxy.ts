import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * `?lang=es|en` on any matched URL sets the language: the cookie goes on the
 * request (so this render uses it) and on the response (so the visit keeps it).
 * It is how a link preview comes out in English: crawlers send no cookie.
 * `/` and `/demo` only match with `?lang`, and get no Supabase client.
 */
export async function proxy(request: NextRequest) {
  const lang = request.nextUrl.searchParams.get('lang')
  const locale = lang === 'es' || lang === 'en' ? lang : null
  if (locale) request.cookies.set('locale', locale)

  const pathname = request.nextUrl.pathname
  const response = pathname === '/' || pathname.startsWith('/demo')
    ? NextResponse.next({ request })
    : await refreshSession(request)

  if (locale) response.cookies.set('locale', locale, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' })
  return response
}

/**
 * Refreshes the Supabase session and keeps `/dashboard` and `/onboarding`
 * behind a login. The pages repeat the redirect so they do not depend on this file.
 */
async function refreshSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) return response

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value)
        response = NextResponse.next({ request })
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options)
        }
      },
    },
  })

  // Verifies the JWT and, when the access token expired, refreshes it and
  // rewrites the cookies through `setAll`. Nothing may run between the client
  // creation and this call.
  const { data } = await supabase.auth.getClaims()

  const pathname = request.nextUrl.pathname
  if (!data?.claims && (pathname.startsWith('/dashboard') || pathname.startsWith('/onboarding'))) {
    const redirect = NextResponse.redirect(new URL('/login', request.url))
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie)
    return redirect
  }

  return response
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/onboarding/:path*',
    '/oauth/:path*',
    '/login',
    '/auth/:path*',
    { source: '/', has: [{ type: 'query', key: 'lang' }] },
    { source: '/demo/:path*', has: [{ type: 'query', key: 'lang' }] },
  ],
}
