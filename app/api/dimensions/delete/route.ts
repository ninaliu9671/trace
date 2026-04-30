import { NextRequest, NextResponse } from 'next/server'
import { createSessionClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSessionClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })

    const { id }: { id: string } = await req.json()

    // 拉取该用户所有活跃维度，在内存里找子孙
    const { data: allDims } = await supabase
      .from('dimensions')
      .select('id, parent_id')
      .eq('user_id', user.id)
      .eq('is_active', true)

    const toDelete = new Set<string>([id])

    function collectChildren(parentId: string) {
      for (const dim of allDims ?? []) {
        if (dim.parent_id === parentId && !toDelete.has(dim.id)) {
          toDelete.add(dim.id)
          collectChildren(dim.id)
        }
      }
    }
    collectChildren(id)

    const { error } = await supabase
      .from('dimensions')
      .update({ is_active: false })
      .in('id', Array.from(toDelete))
      .eq('user_id', user.id)

    if (error) throw error
    return NextResponse.json({ deletedIds: Array.from(toDelete) })
  } catch (e) {
    const msg = (e as { message?: string })?.message || String(e)
    console.error('[dimensions/delete] error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
