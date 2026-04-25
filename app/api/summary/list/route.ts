import { NextResponse } from 'next/server'
import { createServerClient, createSessionClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const sessionClient = await createSessionClient()
    const { data: { user } } = await sessionClient.auth.getUser()
    if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })

    const serverClient = createServerClient()
    const { data: summaries, error } = await serverClient
      .from('summaries')
      .select('*')
      .eq('user_id', user.id)
      .order('date_from', { ascending: false })

    if (error) throw error
    return NextResponse.json({ summaries: summaries ?? [] })
  } catch {
    return NextResponse.json({ error: '加载失败，请稍后重试' }, { status: 500 })
  }
}
