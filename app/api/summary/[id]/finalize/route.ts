import { NextRequest, NextResponse } from 'next/server'
import { createSessionClient } from '@/lib/supabase/server'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createSessionClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })

    const { error } = await supabase
      .from('summaries')
      .update({
        is_draft: false,
        finalized_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: '定稿失败，请稍后重试' }, { status: 500 })
  }
}
