import { NextRequest, NextResponse } from 'next/server'
import { createSessionClient } from '@/lib/supabase/server'
import { callAI } from '@/lib/ai'
import { PROMPTS } from '@/lib/prompts'
import { expandSelectedDimensionIds } from '@/lib/summary-dimensions'

const priorityMap: Record<string, string[]> = {
  annual:    ['quarterly', 'monthly', 'weekly'],
  quarterly: ['monthly', 'weekly'],
  monthly:   ['weekly'],
  weekly:    [],
  adhoc:     [],
}

const TYPE_LABELS: Record<string, string> = {
  weekly: '周报', monthly: '月报', quarterly: '季报',
  annual: '年报/述职', adhoc: '临时汇报',
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
      dimensionIds,
      reportNodeId,
      completeness,
    }: {
      dateFrom: string
      dateTo: string
      summaryType: string
      dimensionIds: string[]
      reportNodeId: string | null
      completeness: string
    } = await req.json()

    const priorities = priorityMap[summaryType] ?? []

    // ── 1. 抓取定稿报告（优先级顺序）──────────────────────
    const foundSummaries: { type: string; content: string; date_from: string; date_to: string }[] = []
    for (const type of priorities) {
      const { data } = await sessionClient
        .from('summaries')
        .select('content, date_from, date_to, summary_type')
        .eq('user_id', user.id)
        .eq('summary_type', type)
        .eq('is_draft', false)
        .gte('date_from', dateFrom)
        .lte('date_to', dateTo)
        .order('date_from')

      if (data?.length) {
        for (const s of data) {
          foundSummaries.push({
            type: s.summary_type,
            content: s.content,
            date_from: s.date_from,
            date_to: s.date_to,
          })
        }
      }
    }

    // ── 2. 抓取原始日志（按维度过滤）──────────────────────
    // 弹窗选择的是一级职能维度，日志写在叶子维度上，所以必须展开子孙维度。
    const { data: allDimensions, error: dimensionsError } = await sessionClient
      .from('dimensions')
      .select('id, name, level, parent_id')
      .eq('user_id', user.id)
      .eq('is_active', true)

    if (dimensionsError) throw dimensionsError

    const expandedDimensionIds = expandSelectedDimensionIds(
      dimensionIds,
      (allDimensions ?? []).map(d => ({
        id: d.id,
        parent_id: d.parent_id,
      }))
    )

    const level1Dimensions = (allDimensions ?? []).filter(d => d.level === 1)
    const selectedLevel1Dimensions = level1Dimensions.filter(d => dimensionIds.includes(d.id))
    const isAllLevel1Selected =
      level1Dimensions.length > 0 && selectedLevel1Dimensions.length === level1Dimensions.length
    const dimensionNamesForDataSource = isAllLevel1Selected
      ? ['全部']
      : selectedLevel1Dimensions.map(d => d.name)

    const { data: logs } = await sessionClient
      .from('daily_logs')
      .select('log_date, content, dimension_id, dimensions(name, level, parent_id)')
      .eq('user_id', user.id)
      .in('dimension_id', expandedDimensionIds.length > 0 ? expandedDimensionIds : ['__none__'])
      .gte('log_date', dateFrom)
      .lte('log_date', dateTo)
      .order('log_date')

    // ── 3. 抓取汇报框架（套用模板时）──────────────────────
    let reportFramework = '（未套用汇报框架，自由生成）'
    let reportNodeName: string | undefined
    if (reportNodeId) {
      const { data: node } = await sessionClient
        .from('report_nodes')
        .select('name, trigger_desc, audience, modules')
        .eq('id', reportNodeId)
        .eq('user_id', user.id)
        .single()

      if (node) {
        reportNodeName = node.name
        const moduleNames = (node.modules as { name: string }[] ?? [])
          .map(m => m.name).join('、')
        reportFramework = [
          `【${node.name}】`,
          node.trigger_desc && `触发时机：${node.trigger_desc}`,
          node.audience && `汇报对象：${node.audience}`,
          moduleNames && `包含模块：${moduleNames}`,
        ].filter(Boolean).join('\n')
      }
    }

    // ── 4. 格式化 sources 字符串（给 AI 看）──────────────
    const logsText = (logs ?? []).map(log => {
      const dims = log.dimensions as { name: string }[] | { name: string } | null
      const dimName = (Array.isArray(dims) ? dims[0]?.name : dims?.name) ?? '未知维度'
      return `[${log.log_date}] [${dimName}] ${log.content}`
    }).join('\n')

    const summariesText = foundSummaries.map(s =>
      `[${TYPE_LABELS[s.type] ?? s.type} ${s.date_from}–${s.date_to}]\n${s.content}`
    ).join('\n\n---\n\n')

    const sourcesText = [
      summariesText && `## 已有定稿报告\n${summariesText}`,
      logsText && `## 日志记录（${(logs ?? []).length} 条）\n${logsText}`,
    ].filter(Boolean).join('\n\n')

    if (!sourcesText) {
      return NextResponse.json(
        { error: '所选时间范围和维度下没有可用于生成总结的日志或定稿报告，请先补写日志。' },
        { status: 400 }
      )
    }

    // ── 5. 组装 systemPrompt，调用 AI ────────────────────
    const systemPrompt = PROMPTS.summary_generate
      .replace('{report_framework}', reportFramework)
      .replace('{completeness}', completeness || 'logs_only')
      .replace('{sources}', sourcesText || '（无数据）')

    const content = await callAI(
      [{ role: 'user', content: `请为我生成一份 ${TYPE_LABELS[summaryType] ?? summaryType}（${dateFrom} 至 ${dateTo}）。` }],
      systemPrompt,
      0.6
    )

    // ── 6. 生成标题 ──────────────────────────────────────
    const fromMonth = dateFrom.slice(0, 7).replace('-', '年') + '月'
    const title = `${fromMonth}${TYPE_LABELS[summaryType] ?? '总结'}`

    // ── 7. 写入 summaries 表 ─────────────────────────────
    const { data: newSummary, error: insertError } = await sessionClient
      .from('summaries')
      .insert({
        user_id: user.id,
        date_from: dateFrom,
        date_to: dateTo,
        summary_type: summaryType,
        title,
        content,
        report_node_id: reportNodeId ?? null,
        data_sources: {
          summaries_used: foundSummaries.map((_, i) => `ref_${i}`),
          logs_count: (logs ?? []).length,
          completeness,
          dimension_names: dimensionNamesForDataSource,
          report_node_name: reportNodeName,
        },
        is_draft: true,
      })
      .select()
      .single()

    if (insertError) throw insertError

    return NextResponse.json({ summary: newSummary })
  } catch (err) {
    console.error('Generate summary error:', err)
    return NextResponse.json({ error: '生成失败，请稍后重试' }, { status: 500 })
  }
}
