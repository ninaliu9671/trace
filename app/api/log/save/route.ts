import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createSessionClient } from '@/lib/supabase/server'

interface LogEntry {
  dimension_id: string
  content: string
  is_ai_generated: boolean
}

export async function POST(req: NextRequest) {
  try {
    const sessionClient = await createSessionClient()
    const {
      data: { user },
    } = await sessionClient.auth.getUser()
    if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })

    const { date, entries }: { date: string; entries: LogEntry[] } = await req.json()

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: '日期格式错误' }, { status: 400 })
    }

    const serverClient = createServerClient()

    const { error: deleteError } = await serverClient
      .from('daily_logs')
      .delete()
      .eq('user_id', user.id)
      .eq('log_date', date)

    if (deleteError) throw deleteError

    const nonEmpty = entries.filter(e => e.content.trim())
    if (nonEmpty.length > 0) {
      const rows = nonEmpty.map(e => ({
        user_id: user.id,
        log_date: date,
        dimension_id: e.dimension_id,
        content: e.content.trim(),
        word_count: e.content.replace(/\s/g, '').length,
        is_ai_generated: e.is_ai_generated,
      }))

      const { error: insertError } = await serverClient.from('daily_logs').insert(rows)

      if (insertError) throw insertError
    }

    return NextResponse.json({ ok: true, savedAt: new Date().toISOString() })
  } catch {
    return NextResponse.json({ error: '保存失败，请稍后重试' }, { status: 500 })
  }
}
