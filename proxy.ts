import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Refreshes the Supabase session on every matched request and keeps
 * `/dashboard` and `/onboarding` behind a login. `/` and `/demo` are outside
 * the matcher, so no Supabase client is created for them. The pages repeat
 * the redirect so they do not depend on this file.
 */
export async function proxy(request: NextRequest) {
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
  matcher: ['/dashboard/:path*', '/onboarding/:path*', '/login', '/auth/:path*'],
}
