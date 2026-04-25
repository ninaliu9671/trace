import { createServerClient as createSupabaseSessionClient, type CookieMethodsServer } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

type SessionCookies = Pick<CookieMethodsServer, 'getAll' | 'setAll'>

export async function createSessionClient(cookieMethods?: SessionCookies) {
  const cookieStore = await cookies()

  return createSupabaseSessionClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: cookieMethods ?? {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // 在 Server Component 中调用时忽略，不影响 Route Handler
          }
        },
      },
    }
  )
}

export function createServerClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY 未配置，请在 .env.local 添加后重启开发服务器')
  }
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key)
}
