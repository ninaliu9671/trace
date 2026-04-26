import { NextRequest, NextResponse } from 'next/server'
import { createSessionClient } from '@/lib/supabase/server'

interface LogEntry {
  dimension_id: string
  content: string
  is_ai_generated: boolean
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSessionClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })

    const { date, entries }: { date: string; entries: LogEntry[] } = await req.json()

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: '日期格式错误' }, { status: 400 })
    }

    // 使用 session client 删除旧记录（RLS 会自动限制为当前用户）
    const { error: deleteError } = await supabase
      .from('daily_logs')
      .delete()
      .eq('user_id', user.id)
      .eq('log_date', date)

    if (deleteError) {
      console.error('Delete error:', deleteError)
      throw new Error(`删除旧记录失败: ${deleteError.message}`)
    }

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

      // 使用 session client 插入新记录（RLS 会自动验证权限）
      const { error: insertError } = await supabase.from('daily_logs').insert(rows)

      if (insertError) {
        console.error('Insert error:', insertError)
        throw new Error(`插入新记录失败: ${insertError.message}`)
      }
    }

    return NextResponse.json({ ok: true, savedAt: new Date().toISOString() })
  } catch (err) {
    console.error('Save log error:', err)
    const errorMessage = err instanceof Error ? err.message : '保存失败，请稍后重试'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
