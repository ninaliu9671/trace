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

    const fields = {
      name: body.name,
      audience: body.audience ?? null,
      style: body.style ?? null,
      modules: body.modules ?? [],
    }

    if (body.id) {
      const { data, error } = await sessionClient
        .from('report_nodes')
        .update(fields)
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
          ...fields,
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
