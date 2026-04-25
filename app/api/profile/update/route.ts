import { NextRequest, NextResponse } from 'next/server'
import { createSessionClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const sessionClient = await createSessionClient()
    const { data: { user } } = await sessionClient.auth.getUser()
    if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })

    const body = await req.json()

    const allowed = [
      'job_title', 'industry', 'work_years', 'company_size',
      'job_responsibilities', 'career_direction', 'skill_focus',
      'onboarding_completed',
    ]
    const updates: Record<string, unknown> = { id: user.id }
    for (const key of allowed) {
      if (key in body) updates[key] = body[key]
    }

    const { error } = await sessionClient.from('user_profiles').upsert(updates)

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = (e as { message?: string })?.message || String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
