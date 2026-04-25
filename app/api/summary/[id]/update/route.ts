import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createSessionClient } from '@/lib/supabase/server'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const sessionClient = await createSessionClient()
    const { data: { user } } = await sessionClient.auth.getUser()
    if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })

    const { content }: { content: string } = await req.json()
    const serverClient = createServerClient()

    const { data: existing } = await serverClient
      .from('summaries')
      .select('id, is_draft, user_id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (!existing) return NextResponse.json({ error: '总结不存在' }, { status: 404 })
    if (!existing.is_draft) return NextResponse.json({ error: '定稿后不可修改' }, { status: 403 })

    const { error } = await serverClient
      .from('summaries')
      .update({ content, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: '保存失败，请稍后重试' }, { status: 500 })
  }
}
