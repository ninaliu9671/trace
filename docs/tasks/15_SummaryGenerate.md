# Task 15 · AI 生成总结 + Loading + 草稿展示

> 完成本 task 后再开始 task 16。
> 完成标准：点「直接生成」→ Loading 遮罩出现（转圈 + 文字每 900ms 轮换）→ AI 生成 Markdown 草稿 → 写入 Supabase → 右侧内容区显示草稿文字，左侧列表出现新条目，无 TS 报错。

---

## 前置要求

- Task 14 已完成并验收通过
- `summaries` 表已在 Supabase 中建好
- `daily_logs`、`report_nodes`、`dimensions` 表均已建好
- `PROMPTS` 已在 `/lib/prompts.ts` 定义（Task 13 加了 `summary_assistant`）

---

## 这次要做什么

### 1. 新增 PROMPTS.summary_generate

**修改 `/lib/prompts.ts`**，追加 `summary_generate`（与 Spec 12.3 对齐）：

```typescript
summary_generate: `
你是职业顾问，帮用户将工作记录整理成汇报总结，输出 Markdown 格式。

【汇报框架】
{report_framework}

【数据完整度】{completeness}

【数据来源】
{sources}

【输出要求】
1. 严格按照用户的汇报框架组织章节（h2/h3 对应框架模块）
2. 从流水账提炼成亮点，不简单堆砌
3. 汇报语气，不是日记语气
4. 只用用户提供的内容，不编造

【特殊标注】
- AI 推测：<!-- ai-guess: 推测内容 -->
- 信息缺口：<!-- placeholder: 请补充：缺少什么 -->

【报告类型语气】
- weekly：平实，强调完成情况和下周计划
- monthly：强调目标达成和趋势
- quarterly：强调战略贡献，有总结性洞察
- annual：强调影响力和成长，语气有分量
- adhoc：根据内容灵活调整语气

【数据完整度处理】
- partial：开头注明「本报告基于 X 篇月报定稿 + Y 条日志生成」
- logs_only：开头注明「本报告直接基于日志生成」
`.trim(),
```

---

### 2. API Route：POST /api/summary/generate

**创建 `app/api/summary/generate/route.ts`**

按 Spec 11.1 的数据抓取优先级逻辑，拼接 AI 上下文，生成草稿，写入 `summaries` 表：

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createSessionClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { callAI } from '@/lib/ai'
import { PROMPTS } from '@/lib/prompts'

// 与 Spec 11.1 的 priorityMap 一致
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
    const cookieStore = cookies()
    const sessionClient = createSessionClient(cookieStore)
    const { data: { user } } = await sessionClient.auth.getUser()
    if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })

    const {
      dateFrom,
      dateTo,
      summaryType,
      dimensionIds,
      reportNodeId,
      completeness,   // 由前端从 check-completeness 拿到后透传
    }: {
      dateFrom: string
      dateTo: string
      summaryType: string
      dimensionIds: string[]
      reportNodeId: string | null
      completeness: string
    } = await req.json()

    const serverClient = createServerClient()
    const priorities = priorityMap[summaryType] ?? []

    // ── 1. 抓取定稿报告（优先级顺序）──────────────────────
    const foundSummaries: { type: string; content: string; date_from: string; date_to: string }[] = []
    for (const type of priorities) {
      const { data } = await serverClient
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
          foundSummaries.push({ type: s.summary_type, content: s.content, date_from: s.date_from, date_to: s.date_to })
        }
      }
    }

    // ── 2. 抓取原始日志（按维度过滤）──────────────────────
    const { data: logs } = await serverClient
      .from('daily_logs')
      .select('log_date, content, dimension_id, dimensions(name, level, parent_id)')
      .eq('user_id', user.id)
      .in('dimension_id', dimensionIds.length > 0 ? dimensionIds : ['__none__'])
      .gte('log_date', dateFrom)
      .lte('log_date', dateTo)
      .order('log_date')

    // ── 3. 抓取汇报框架（套用模板时）──────────────────────
    let reportFramework = '（未套用汇报框架，自由生成）'
    if (reportNodeId) {
      const { data: node } = await serverClient
        .from('report_nodes')
        .select('name, trigger_desc, audience, modules')
        .eq('id', reportNodeId)
        .single()

      if (node) {
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
      const dimName = (log.dimensions as { name: string } | null)?.name ?? '未知维度'
      return `[${log.log_date}] [${dimName}] ${log.content}`
    }).join('\n')

    const summariesText = foundSummaries.map(s =>
      `[${TYPE_LABELS[s.type] ?? s.type} ${s.date_from}–${s.date_to}]\n${s.content}`
    ).join('\n\n---\n\n')

    const sourcesText = [
      summariesText && `## 已有定稿报告\n${summariesText}`,
      logsText && `## 日志记录（${(logs ?? []).length} 条）\n${logsText}`,
    ].filter(Boolean).join('\n\n')

    // ── 5. 组装 systemPrompt，调用 AI ────────────────────
    const systemPrompt = PROMPTS.summary_generate
      .replace('{report_framework}', reportFramework)
      .replace('{completeness}', completeness || 'logs_only')
      .replace('{sources}', sourcesText || '（无数据）')

    const content = await callAI(
      [{ role: 'user', content: `请为我生成一份 ${TYPE_LABELS[summaryType] ?? summaryType}（${dateFrom} 至 ${dateTo}）。` }],
      systemPrompt,
      0.6   // 总结生成稍低温度，减少发散
    )

    // ── 6. 生成标题 ──────────────────────────────────────
    const fromMonth = dateFrom.slice(0, 7).replace('-', '年') + '月'
    const title = `${fromMonth}${TYPE_LABELS[summaryType] ?? '总结'}`

    // ── 7. 写入 summaries 表 ─────────────────────────────
    const { data: newSummary, error: insertError } = await serverClient
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
          summaries_used: foundSummaries.map((_, i) => `ref_${i}`),  // 简化引用
          logs_count: (logs ?? []).length,
          completeness,
        },
        is_draft: true,
      })
      .select()
      .single()

    if (insertError) throw insertError

    return NextResponse.json({ summary: newSummary })
  } catch {
    return NextResponse.json({ error: '生成失败，请稍后重试' }, { status: 500 })
  }
}
```

---

### 3. SummaryGeneratingOverlay 组件

**创建 `components/summary/SummaryGeneratingOverlay.tsx`**

全屏遮罩，转圈动画 + 每 900ms 轮换提示文字：

```typescript
'use client'
import { useState, useEffect } from 'react'

const MESSAGES = [
  'AI 正在读取你的工作日志...',
  'AI 正在分析日志内容...',
  'AI 正在提炼工作亮点...',
  'AI 正在整理汇报结构...',
  '草稿即将生成完成...',
]

export default function SummaryGeneratingOverlay() {
  const [msgIndex, setMsgIndex] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setMsgIndex(prev => (prev + 1) % MESSAGES.length)
    }, 900)
    return () => clearInterval(timer)
  }, [])

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 60,
      background: 'rgba(248,247,244,0.85)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 20,
    }}>
      {/* 转圈动画（CSS keyframes via style tag） */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
      <div style={{
        width: 36, height: 36,
        border: '3px solid #E8E4DD',
        borderTop: '3px solid #1D9E75',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }} />
      <div style={{
        fontSize: 13,
        color: '#6B6B6B',
        textAlign: 'center',
        minWidth: 240,
        transition: 'opacity 0.3s ease',
      }}>
        {MESSAGES[msgIndex]}
      </div>
    </div>
  )
}
```

---

### 4. SummaryPage：接入生成流程

**修改 `app/summary/page.tsx`**，完善 Task 14 预留的 `handleStartGenerate` 占位：

#### 新增 import 和状态

```typescript
import SummaryGeneratingOverlay from '@/components/summary/SummaryGeneratingOverlay'
import { CompletenessResult, NewSummaryParams, Summary } from '@/types'

const [generating, setGenerating] = useState(false)
```

#### 替换 handleStartGenerate

```typescript
async function handleStartGenerate(params: NewSummaryParams, completenessData: CompletenessResult | null) {
  setCompletenessResult(null)
  setPendingParams(null)
  setGenerating(true)

  try {
    const res = await fetch('/api/summary/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dateFrom: params.dateFrom,
        dateTo: params.dateTo,
        summaryType: params.summaryType,
        dimensionIds: params.dimensionIds,
        reportNodeId: params.reportNodeId,
        completeness: completenessData?.completeness ?? 'logs_only',
      }),
    })
    const data = await res.json()

    if (data.error) {
      alert(data.error)
      return
    }

    const newSummary: Summary = data.summary
    // 将新总结插入列表头部（date_from 最新，倒序排列）
    setSummaries(prev => [newSummary, ...prev])
    // 自动选中并展示新草稿
    setSelectedId(newSummary.id)
  } catch {
    alert('生成失败，请稍后重试')
  } finally {
    setGenerating(false)
  }
}
```

#### JSX 中挂载遮罩

```typescript
// 在 JSX 末尾追加（DataCompletenessAlert 之后）：
{generating && <SummaryGeneratingOverlay />}
```

#### 右侧内容区草稿预览（占位显示）

在右侧内容区的 `selectedSummary` 分支中，显示草稿内容（Task 16 用 MarkdownEditor 替换）：

```typescript
{selectedSummary ? (
  <div style={{ padding: '24px', flex: 1 }}>
    {/* Task 16 替换为 MarkdownEditor */}
    <pre style={{
      fontSize: 13,
      color: '#1A1A1A',
      lineHeight: 1.8,
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-word',
      fontFamily: 'JetBrains Mono, monospace',
      margin: 0,
    }}>
      {selectedSummary.content}
    </pre>
  </div>
) : (
  <EmptyState />
)}
```

同时更新顶部标题栏中 `selectedSummary` 分支的 meta 信息：

```typescript
{selectedSummary ? (
  <>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <span style={{ fontSize: 15, fontWeight: 500, color: '#1A1A1A' }}>
        {selectedSummary.title ?? formatSummaryTitle(selectedSummary)}
      </span>
      {/* meta 标签行 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <MetaTag label={TYPE_LABELS[selectedSummary.summary_type] ?? '总结'} />
        <MetaTag label={`${selectedSummary.date_from} 至 ${selectedSummary.date_to}`} />
        {selectedSummary.is_draft && (
          <span style={{
            fontSize: 10, padding: '1px 5px', borderRadius: 3,
            background: '#FFFBEB', color: '#92400E',
            border: '1px solid #FDE68A',
          }}>草稿</span>
        )}
      </div>
    </div>
    {/* AI 助手按钮（同上） */}
    ...
  </>
) : ...}
```

在 `app/summary/page.tsx` 文件顶部追加辅助组件和常量：

```typescript
const TYPE_LABELS: Record<string, string> = {
  weekly: '周报', monthly: '月报', quarterly: '季报',
  annual: '年报/述职', adhoc: '临时汇报',
}

function MetaTag({ label }: { label: string }) {
  return (
    <span style={{
      fontSize: 11, color: '#6B6B6B',
      background: '#F4F3F0',
      border: '1px solid #E8E4DD',
      borderRadius: 4,
      padding: '1px 6px',
    }}>
      {label}
    </span>
  )
}
```

---

## 不做什么

```
❌ Markdown 编辑/预览切换（Task 16 做，现在用 <pre> 占位显示）
❌ 操作栏（恢复上版 / 存为定稿，Task 16 做）
❌ AI 替换建议（Task 17 做）
❌ 生成失败后的重试入口（用 alert 简单提示，Task 16 完善）
❌ 流式输出（全局统一非流式）
❌ data_sources 中 summaries_used 存储真实 id（简化为占位，不影响主流程）
```

---

## 完成标准

```
□ 点「直接生成」或数据完整时 → 全屏 Loading 遮罩出现
□ 遮罩中有转圈动画（绿色 border-top）
□ 提示文字每 900ms 轮换一条（共 5 条循环）
□ 生成期间背景可见但模糊（backdropFilter: blur）
□ 生成完成 → Loading 遮罩消失
□ 左侧列表顶部出现新条目（「草稿」徽章 + 正确标题 + 日期范围）
□ 右侧内容区自动切换到新草稿，显示 AI 生成的 Markdown 原文（pre 标签）
□ 顶部标题栏显示总结标题 + 报告类型标签 + 日期范围
□ 刷新页面后列表仍有该条目（数据已写入 Supabase）
□ AI 生成内容包含 Markdown 标题结构（## / ###）
□ 数据较少时 AI 草稿开头有完整度说明（「本报告直接基于日志生成」等）
□ 生成失败时 alert 显示错误提示，不崩溃
□ 无 TypeScript 报错
□ npm run dev 无报错
```

---

## 做完后告诉我

1. 做了哪些文件
2. Loading 文字轮换是否每 900ms 切换一条
3. 生成后左侧列表是否自动出现新条目并选中（右侧显示内容）
4. Supabase `summaries` 表是否有新记录写入（刷新后仍能看到）
5. 不要自动开始 task 16，等我验收

---

*Task 15 | 2026.04.24*
