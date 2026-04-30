import { NextRequest, NextResponse } from 'next/server'
import { createSessionClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSessionClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })

    const { ids }: { ids: string[] } = await req.json()
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: '参数错误' }, { status: 400 })
    }

    await Promise.all(
      ids.map((id, index) =>
        supabase
          .from('report_nodes')
          .update({ sort_order: index })
          .eq('id', id)
          .eq('user_id', user.id)
      )
    )

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: '排序保存失败' }, { status: 500 })
  }
}
