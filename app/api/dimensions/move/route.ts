import { NextRequest, NextResponse } from 'next/server'
import { createSessionClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSessionClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })

    const { id, newParentId, insertBeforeId }: {
      id: string
      newParentId: string | null
      insertBeforeId: string | null
    } = await req.json()

    const { data: allDims, error: fetchError } = await supabase
      .from('dimensions')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)

    if (fetchError) throw fetchError

    const dims = allDims ?? []
    const node = dims.find((d: { id: string }) => d.id === id)
    if (!node) return NextResponse.json({ error: '维度不存在' }, { status: 404 })

    // Prevent dropping into self
    if (newParentId === id) {
      return NextResponse.json({ error: '不能将节点移入自身' }, { status: 400 })
    }

    // Prevent dropping into own descendants
    function isDescendant(ancestorId: string, nodeId: string): boolean {
      const n = dims.find((d: { id: string }) => d.id === nodeId)
      if (!n || !n.parent_id) return false
      if (n.parent_id === ancestorId) return true
      return isDescendant(ancestorId, n.parent_id)
    }
    if (newParentId && isDescendant(id, newParentId)) {
      return NextResponse.json({ error: '不能将节点移入其子孙节点' }, { status: 400 })
    }

    // Compute new level
    let newLevel: number
    if (newParentId === null) {
      newLevel = 1
    } else {
      const parent = dims.find((d: { id: string }) => d.id === newParentId)
      if (!parent) return NextResponse.json({ error: '目标父节点不存在' }, { status: 404 })
      newLevel = parent.level + 1
    }

    const levelDelta = newLevel - node.level

    // Collect all descendants
    function getDescendants(nodeId: string): string[] {
      const children = dims.filter((d: { parent_id: string | null }) => d.parent_id === nodeId)
      return (children as { id: string }[]).flatMap(c => [c.id, ...getDescendants(c.id)])
    }
    const descendantIds = getDescendants(id)

    // Old siblings (after removal of moved node)
    const oldSiblings = dims
      .filter((d: { parent_id: string | null; id: string }) => d.parent_id === node.parent_id && d.id !== id)
      .sort((a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order)

    // New siblings (excluding moved node, same parent_id as destination)
    const newSiblings = dims
      .filter((d: { parent_id: string | null; id: string }) => d.parent_id === newParentId && d.id !== id)
      .sort((a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order)

    // Insert position
    let insertAt = newSiblings.length
    if (insertBeforeId) {
      const idx = (newSiblings as { id: string }[]).findIndex(d => d.id === insertBeforeId)
      if (idx !== -1) insertAt = idx
    }

    type Update = { id: string; changes: Record<string, unknown> }
    const updates: Update[] = []

    // Moved node
    updates.push({ id, changes: { parent_id: newParentId, level: newLevel, sort_order: insertAt } })

    // Descendants: shift level
    for (const descId of descendantIds) {
      const desc = dims.find((d: { id: string }) => d.id === descId)
      if (desc) updates.push({ id: descId, changes: { level: desc.level + levelDelta } })
    }

    // Re-number old siblings
    ;(oldSiblings as { id: string }[]).forEach((s, i) => {
      updates.push({ id: s.id, changes: { sort_order: i } })
    })

    // Re-number new siblings (leave slot at insertAt for the moved node)
    ;(newSiblings as { id: string }[]).forEach((s, i) => {
      updates.push({ id: s.id, changes: { sort_order: i < insertAt ? i : i + 1 } })
    })

    await Promise.all(
      updates.map(({ id: uid, changes }) =>
        supabase.from('dimensions').update(changes).eq('id', uid).eq('user_id', user.id)
      )
    )

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: '移动失败，请稍后重试' }, { status: 500 })
  }
}
