import { NextRequest, NextResponse } from 'next/server'
import { createSessionClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const sessionClient = await createSessionClient()
    const { data: { user } } = await sessionClient.auth.getUser()
    if (!user) {
      console.error('[report-nodes/save] no user in session - cookies may not be forwarded')
      return NextResponse.json({ error: '未登录' }, { status: 401 })
    }

    const body = await req.json()

    if (body.id) {
      const { data, error } = await sessionClient
        .from('report_nodes')
        .update({
          name: body.name,
          trigger_desc: body.trigger_desc ?? null,
          audience: body.audience ?? null,
          modules: body.modules ?? [],
          parent_id: body.parent_id ?? null,
          time_granularity: body.time_granularity ?? null,
        })
        .eq('id', body.id)
        .eq('user_id', user.id)
        .select()
        .single()
      if (error) throw error
      return NextResponse.json({ node: data })
    } else {
      const { data, error } = await sessionClient
        .from('report_nodes')
        .insert({
          user_id: user.id,
          name: body.name,
          trigger_desc: body.trigger_desc ?? null,
          audience: body.audience ?? null,
          modules: body.modules ?? [],
          parent_id: body.parent_id ?? null,
          time_granularity: body.time_granularity ?? null,
          sort_order: body.sort_order ?? 99,
          is_active: true,
        })
        .select()
        .single()
      if (error) throw error
      return NextResponse.json({ node: data })
    }
  } catch (e) {
    const msg = (e as { message?: string })?.message || String(e)
    console.error('[report-nodes/save] error:', msg, e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
