import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createSessionClient } from '@/lib/supabase/server'

const priorityMap: Record<string, string[]> = {
  annual:    ['quarterly', 'monthly', 'weekly'],
  quarterly: ['monthly', 'weekly'],
  monthly:   ['weekly'],
  weekly:    [],
  adhoc:     [],
}

const TYPE_LABELS: Record<string, string> = {
  weekly:    '周报',
  monthly:   '月报',
  quarterly: '季报',
  annual:    '年报',
  adhoc:     '临时汇报',
}

export async function POST(req: NextRequest) {
  try {
    const sessionClient = await createSessionClient()
    const { data: { user } } = await sessionClient.auth.getUser()
    if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })

    const {
      dateFrom,
      dateTo,
      summaryType,
    }: {
      dateFrom: string
      dateTo: string
      summaryType: string
    } = await req.json()

    const serverClient = createServerClient()
    const priorities = priorityMap[summaryType] ?? []

    const foundSummaries: { type: string; count: number; label: string }[] = []
    const missingTypes: { type: string; label: string }[] = []

    // 按优先级查找定稿报告
    for (const type of priorities) {
      const { data } = await serverClient
        .from('summaries')
        .select('id, date_from, date_to, summary_type')
        .eq('user_id', user.id)
        .eq('summary_type', type)
        .eq('is_draft', false)
        .gte('date_from', dateFrom)
        .lte('date_to', dateTo)
        .order('date_from')

      const count = data?.length ?? 0
      if (count > 0) {
        const months = (data ?? [])
          .slice(0, 3)
          .map(s => {
            const m = parseInt(s.date_from.split('-')[1])
            return `${m}月`
          })
          .join('、')
        const suffix = count > 3 ? `等 ${count} 篇` : `（${months}）`
        foundSummaries.push({
          type,
          count,
          label: `找到 ${count} 篇${TYPE_LABELS[type] ?? type}定稿${suffix}`,
        })
      } else {
        missingTypes.push({
          type,
          label: `${TYPE_LABELS[type] ?? type}缺失（将用日志补充）`,
        })
      }
    }

    // 统计时间范围内的日志数量
    const { count: logsCount } = await serverClient
      .from('daily_logs')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('log_date', dateFrom)
      .lte('log_date', dateTo)

    const logs_count = logsCount ?? 0

    const completeness =
      priorities.length === 0
        ? 'logs_only'
        : foundSummaries.length >= priorities.length
          ? 'complete'
          : foundSummaries.length > 0
            ? 'partial'
            : 'logs_only'

    return NextResponse.json({
      completeness,
      found_summaries: foundSummaries,
      missing_types: missingTypes,
      logs_count,
    })
  } catch {
    return NextResponse.json({ error: '检查失败，请稍后重试' }, { status: 500 })
  }
}
