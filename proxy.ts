import { NextResponse, type NextRequest } from 'next/server'
import { isProtectedPath } from '@/lib/auth'
import { createSessionClient } from '@/lib/supabase/server'

export async function proxy(request: NextRequest) {
  const response = NextResponse.next()
  const supabase = await createSessionClient({
    getAll: () => request.cookies.getAll(),
    setAll: (cookiesToSet, headers) => {
      cookiesToSet.forEach(({ name, value, options }) => {
        response.cookies.set(name, value, options)
      })

      Object.entries(headers).forEach(([key, value]) => {
        response.headers.set(key, value)
      })
    },
  })
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user && isProtectedPath(request.nextUrl.pathname)) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return response
}

export const config = {
  matcher: ['/profile/:path*', '/log/:path*', '/summary/:path*'],
}
