import { NextRequest, NextResponse } from 'next/server'
import { createSessionClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const sessionClient = await createSessionClient()
    const { data: { user } } = await sessionClient.auth.getUser()
    if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })

    const { id } = await req.json()
    if (!id) return NextResponse.json({ error: '缺少 id' }, { status: 400 })

    const { error } = await sessionClient
      .from('report_nodes')
      .update({ is_active: false })
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = (e as { message?: string })?.message || String(e)
    console.error('[report-nodes/delete] error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
