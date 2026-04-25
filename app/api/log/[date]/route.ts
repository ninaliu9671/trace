import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createSessionClient } from '@/lib/supabase/server'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ date: string }> }
) {
  try {
    const sessionClient = await createSessionClient()
    const {
      data: { user },
    } = await sessionClient.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '未登录' }, { status: 401 })
    }

    const { date } = await params
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: '日期格式错误' }, { status: 400 })
    }

    const serverClient = createServerClient()
    const { data: logs, error } = await serverClient
      .from('daily_logs')
      .select('*')
      .eq('user_id', user.id)
      .eq('log_date', date)

    if (error) throw error

    return NextResponse.json({ logs: logs ?? [] })
  } catch {
    return NextResponse.json({ error: '加载失败，请稍后重试' }, { status: 500 })
  }
}
