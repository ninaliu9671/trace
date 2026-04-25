import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const rootDir = path.resolve(import.meta.dirname, '..')

async function readProjectFile(relativePath) {
  return readFile(path.join(rootDir, relativePath), 'utf8')
}

test('root page redirects authenticated users to profile and guests to login', async () => {
  const source = await readProjectFile('app/page.tsx')

  assert.match(source, /redirect\('\/profile'\)|redirect\("\/profile"\)/)
  assert.match(source, /redirect\('\/login'\)|redirect\("\/login"\)/)
  assert.match(source, /createSessionClient/)
  assert.match(source, /auth\.getUser\(/)
})

test('client supabase wrapper creates a browser client with anon credentials', async () => {
  const source = await readProjectFile('lib/supabase/client.ts')

  assert.match(source, /createBrowserClient/)
  assert.match(source, /NEXT_PUBLIC_SUPABASE_URL/)
  assert.match(source, /NEXT_PUBLIC_SUPABASE_ANON_KEY/)
})

test('server supabase wrapper exposes session and service-role clients', async () => {
  const source = await readProjectFile('lib/supabase/server.ts')

  assert.match(source, /createSessionClient/)
  assert.match(source, /createServerClient/)
  assert.match(source, /createServerClient as createSupabaseServerClient|createServerClient\(/)
  assert.match(source, /SUPABASE_SERVICE_ROLE_KEY/)
  assert.match(source, /cookies/)
})

test('proxy protects profile, log, and summary routes', async () => {
  const source = await readProjectFile('proxy.ts')

  assert.match(source, /export\s+(async\s+)?function\s+proxy/)
  assert.match(source, /createSessionClient\(/)
  assert.match(source, /auth\.getUser\(/)
  assert.match(source, /\/login/)
  assert.match(source, /matcher/)
  assert.match(source, /profile/)
  assert.match(source, /log/)
  assert.match(source, /summary/)
})

test('login page supports login and signup modes with loading and mapped auth errors', async () => {
  const source = await readProjectFile('app/login/page.tsx')

  assert.match(source, /'use client'/)
  assert.match(source, /createClient\(/)
  assert.match(source, /signUp\(/)
  assert.match(source, /signInWithPassword\(/)
  assert.match(source, /validateAuthForm\(/)
  assert.match(source, /mapAuthErrorMessage\(/)
  assert.match(source, /处理中\.\.\./)
  assert.match(source, /confirmPassword/)
  assert.match(source, /router\.push\('\/profile'\)|router\.push\("\/profile"\)/)
})

test('login page follows Task 00 visual tokens', async () => {
  const source = await readProjectFile('app/login/page.tsx')

  assert.match(source, /#F8F7F4/)
  assert.match(source, /#E8E4DD/)
  assert.match(source, /#1D9E75/)
  assert.match(source, /380px|w-\[380px\]/)
})

test('profile route exists for authenticated landing after login', async () => {
  const source = await readProjectFile('app/profile/page.tsx')

  assert.match(source, /export\s+default\s+function/)
  assert.match(source, /职业档案/)
  assert.match(source, /Sidebar/)
})
