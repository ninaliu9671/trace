import { NextRequest, NextResponse } from 'next/server'
import { createSessionClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const sessionClient = await createSessionClient()
    const { data: { user } } = await sessionClient.auth.getUser()
    if (!user) {
      console.error('[dimensions/save] no user in session - cookies may not be forwarded')
      return NextResponse.json({ error: '未登录' }, { status: 401 })
    }

    const body = await req.json()

    if (body.id) {
      const { data, error } = await sessionClient
        .from('dimensions')
        .update({
          name: body.name,
          icon: body.icon ?? '📋',
          level: body.level,
          parent_id: body.parent_id ?? null,
          sort_order: body.sort_order ?? 0,
          prompt_text: body.level === 3 ? (body.prompt_text ?? null) : null,
        })
        .eq('id', body.id)
        .eq('user_id', user.id)
        .select()
        .single()
      if (error) throw error
      return NextResponse.json({ dimension: data })
    } else {
      const { data, error } = await sessionClient
        .from('dimensions')
        .insert({
          user_id: user.id,
          name: body.name,
          icon: body.icon ?? '📋',
          level: body.level,
          parent_id: body.parent_id ?? null,
          sort_order: body.sort_order ?? 99,
          prompt_text: body.level === 3 ? (body.prompt_text ?? null) : null,
          is_active: true,
        })
        .select()
        .single()
      if (error) throw error
      return NextResponse.json({ dimension: data })
    }
  } catch (e) {
    const msg = (e as { message?: string })?.message || String(e)
    console.error('[dimensions/save] error:', msg, e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
