# Task 13 · SummaryPage 框架 + SummaryList

> 完成本 task 后再开始 task 14。
> 完成标准：/summary 两栏布局正确，历史总结列表按月分组展示，文档属性浮层可打开，无选中时右侧显示空状态，无 TS 报错。

---

## 前置要求

- Task 07 已完成并验收通过（dimensions 表有数据）
- Task 12 已完成并验收通过（/log 模块完整）
- `Sidebar.tsx` 已存在（Task 01）
- `AiSidePanel.tsx` 已存在（Task 03）
- `summaries` 表已在 Supabase 中建好（见 Spec 十节）

---

## 这次要做什么

### 1. 新增类型

**修改 `/types/index.ts`**，追加 summary 相关类型：

```typescript
export interface Summary {
  id: string
  user_id: string
  created_at: string
  updated_at: string
  date_from: string            // 'YYYY-MM-DD'
  date_to: string              // 'YYYY-MM-DD'
  summary_type: 'weekly' | 'monthly' | 'quarterly' | 'annual' | 'adhoc'
  title: string | null
  content: string              // Markdown
  report_node_id: string | null
  data_sources: {
    summaries_used?: string[]
    logs_count?: number
    completeness?: 'complete' | 'partial' | 'logs_only'
  }
  is_draft: boolean
  finalized_at: string | null
  // 关联查询带入（非数据库字段）
  dimension_names?: string[]   // 维度标签，前端从 data_sources 或专用字段解析
}

// 新建总结弹窗参数（Task 14 用）
export interface NewSummaryParams {
  dateFrom: string
  dateTo: string
  summaryType: Summary['summary_type']
  dimensionIds: string[]       // 选中的维度 id 列表
  reportNodeId: string | null  // 套用的汇报框架节点 id
}
```

> `dimension_names` 在 Task 15 生成时写入 `data_sources`，Task 13 只展示列表，暂时可能为空。

---

### 2. API Route：GET /api/summary/list

**创建 `app/api/summary/list/route.ts`**

返回当前用户所有总结，按 `date_from` 倒序：

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createSessionClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

export async function GET(req: NextRequest) {
  try {
    const cookieStore = cookies()
    const sessionClient = createSessionClient(cookieStore)
    const { data: { user } } = await sessionClient.auth.getUser()
    if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })

    const serverClient = createServerClient()
    const { data: summaries, error } = await serverClient
      .from('summaries')
      .select('*')
      .eq('user_id', user.id)
      .order('date_from', { ascending: false })

    if (error) throw error
    return NextResponse.json({ summaries: summaries ?? [] })
  } catch {
    return NextResponse.json({ error: '加载失败，请稍后重试' }, { status: 500 })
  }
}
```

---

### 3. /summary 页面主布局

**创建 `app/summary/page.tsx`**

```typescript
'use client'
import { useState, useEffect } from 'react'
import Sidebar from '@/components/layout/Sidebar'
import AiSidePanel from '@/components/AiSidePanel'
import SummaryList from '@/components/summary/SummaryList'
import { Summary } from '@/types'
import { PROMPTS } from '@/lib/prompts'

export default function SummaryPage() {
  const [summaries, setSummaries] = useState<Summary[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [aiOpen, setAiOpen] = useState(false)

  useEffect(() => {
    async function fetchSummaries() {
      setLoading(true)
      const res = await fetch('/api/summary/list')
      const data = await res.json()
      setSummaries(data.summaries ?? [])
      setLoading(false)
    }
    fetchSummaries()
  }, [])

  const selectedSummary = summaries.find(s => s.id === selectedId) ?? null

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#F8F7F4', overflow: 'hidden' }}>
      {/* 左侧导航栏 */}
      <Sidebar />

      {/* 主内容区 */}
      <div style={{
        flex: 1,
        display: 'flex',
        overflow: 'hidden',
        marginRight: aiOpen ? 280 : 0,
        transition: 'margin-right 0.2s ease',
      }}>
        {/* 左侧总结列表（220px） */}
        <div style={{
          width: 220,
          flexShrink: 0,
          borderRight: '1px solid #F0EDE8',
          background: '#FAFAF8',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}>
          {/* 列表顶部标题 + 新建按钮 */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 14px 10px',
            borderBottom: '1px solid #F0EDE8',
            flexShrink: 0,
          }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: '#1A1A1A' }}>工作总结</span>
            <button
              onClick={() => {/* Task 14 实现 */}}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 3,
                padding: '4px 8px',
                background: '#1D9E75',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              + 新建
            </button>
          </div>

          {/* 列表内容 */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loading ? (
              <div style={{ padding: '16px 14px', fontSize: 12, color: '#B0ADA6' }}>
                加载中...
              </div>
            ) : (
              <SummaryList
                summaries={summaries}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />
            )}
          </div>
        </div>

        {/* 右侧内容区 */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* 顶部栏（操作栏，Task 16 完善） */}
          <div style={{
            height: 56,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 24px',
            borderBottom: '1px solid #F0EDE8',
            flexShrink: 0,
            background: '#F8F7F4',
          }}>
            {selectedSummary ? (
              <>
                {/* 文档标题 + meta（Task 16 完善） */}
                <div>
                  <span style={{ fontSize: 15, fontWeight: 500, color: '#1A1A1A' }}>
                    {selectedSummary.title ?? formatSummaryTitle(selectedSummary)}
                  </span>
                </div>
                {/* 右侧操作按钮（Task 16 完善） */}
                <button
                  onClick={() => setAiOpen(prev => !prev)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 12px',
                    background: aiOpen ? '#1D9E75' : '#E8F7F2',
                    color: aiOpen ? '#FFFFFF' : '#0F6E56',
                    border: `1px solid ${aiOpen ? '#1D9E75' : '#9FE1CB'}`,
                    borderRadius: 7,
                    fontSize: 12,
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  ✦ AI 助手
                </button>
              </>
            ) : (
              <>
                <span style={{ fontSize: 15, fontWeight: 500, color: '#1A1A1A' }}>汇报总结</span>
                <button
                  onClick={() => setAiOpen(prev => !prev)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 12px',
                    background: aiOpen ? '#1D9E75' : '#E8F7F2',
                    color: aiOpen ? '#FFFFFF' : '#0F6E56',
                    border: `1px solid ${aiOpen ? '#1D9E75' : '#9FE1CB'}`,
                    borderRadius: 7,
                    fontSize: 12,
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  ✦ AI 助手
                </button>
              </>
            )}
          </div>

          {/* 内容主区域 */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {selectedSummary ? (
              /* Task 16 实现：MarkdownEditor + SummaryTopbar */
              <div style={{ padding: 24, fontSize: 13, color: '#B0ADA6' }}>
                内容编辑区（Task 16 实现）
              </div>
            ) : (
              <EmptyState />
            )}
          </div>
        </div>
      </div>

      {/* AI 面板 */}
      <AiSidePanel
        isOpen={aiOpen}
        onClose={() => setAiOpen(false)}
        contextLabel={
          selectedSummary
            ? `已读取：${selectedSummary.title ?? formatSummaryTitle(selectedSummary)}`
            : '请先选择一份总结'
        }
        systemPrompt={PROMPTS.summary_assistant.replace(
          '{current_content}',
          selectedSummary?.content ?? '（未选中任何总结）'
        )}
        apiRoute="/api/summary/ai-chat"
      />
    </div>
  )
}

// 无选中状态（右侧占位）
function EmptyState() {
  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      height: '100%',
      color: '#B0ADA6',
    }}>
      <span style={{ fontSize: 32 }}>◫</span>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 13, marginBottom: 4 }}>点击左侧列表查看总结</div>
        <div style={{ fontSize: 12 }}>或点击「+ 新建」创建新的工作总结</div>
      </div>
    </div>
  )
}

// 根据 summary 字段生成备用标题
function formatSummaryTitle(summary: Summary): string {
  const typeLabels: Record<Summary['summary_type'], string> = {
    weekly: '周报',
    monthly: '月报',
    quarterly: '季报',
    annual: '年报/述职',
    adhoc: '临时汇报',
  }
  const label = typeLabels[summary.summary_type] ?? '总结'
  const from = summary.date_from.slice(0, 7).replace('-', '年') + '月'
  return `${from}${label}`
}
```

---

### 4. SummaryList 组件

**创建 `components/summary/SummaryList.tsx`**

按月分组，月份倒序，每月内按 `date_from` 倒序：

```typescript
'use client'
import { Summary } from '@/types'
import SummaryListItem from './SummaryListItem'

interface SummaryListProps {
  summaries: Summary[]
  selectedId: string | null
  onSelect: (id: string) => void
}

// 将 'YYYY-MM-DD' 提取为 'YYYY年M月' 分组 key
function getMonthKey(dateStr: string): string {
  const [y, m] = dateStr.split('-')
  return `${y}年${parseInt(m)}月`
}

export default function SummaryList({ summaries, selectedId, onSelect }: SummaryListProps) {
  if (summaries.length === 0) {
    return (
      <div style={{ padding: '24px 14px', textAlign: 'center', fontSize: 12, color: '#B0ADA6' }}>
        还没有总结记录。<br />点击「+ 新建」生成第一份。
      </div>
    )
  }

  // 按月分组
  const groups: Record<string, Summary[]> = {}
  for (const s of summaries) {
    const key = getMonthKey(s.date_from)
    if (!groups[key]) groups[key] = []
    groups[key].push(s)
  }

  // 月份倒序（与 summaries 已按 date_from 倒序，取第一条 key 顺序即可）
  const months = Object.keys(groups)

  return (
    <div style={{ padding: '8px 0' }}>
      {months.map(month => (
        <div key={month}>
          {/* 月份分隔行 */}
          <div style={{
            padding: '8px 14px 4px',
            fontSize: 11,
            color: '#B0ADA6',
            fontWeight: 500,
            letterSpacing: '0.5px',
          }}>
            ── {month} ──
          </div>

          {/* 该月下的总结条目 */}
          {groups[month].map(summary => (
            <SummaryListItem
              key={summary.id}
              summary={summary}
              isSelected={summary.id === selectedId}
              onSelect={() => onSelect(summary.id)}
            />
          ))}
        </div>
      ))}
    </div>
  )
}
```

---

### 5. SummaryListItem 组件

**创建 `components/summary/SummaryListItem.tsx`**

每条总结显示徽章、名称、时间范围、维度标签，以及「▸ 文档属性」折叠入口：

```typescript
'use client'
import { useState, useRef, useEffect } from 'react'
import { Summary } from '@/types'

interface SummaryListItemProps {
  summary: Summary
  isSelected: boolean
  onSelect: () => void
}

// 报告类型中文标签
const TYPE_LABELS: Record<Summary['summary_type'], string> = {
  weekly: '周报',
  monthly: '月报',
  quarterly: '季报',
  annual: '年报',
  adhoc: '临时',
}

// 格式化日期范围 '2026-04-21' → '4月21日'
function formatShortDate(dateStr: string): string {
  const [, m, d] = dateStr.split('-')
  return `${parseInt(m)}月${parseInt(d)}日`
}

// 格式化完整日期范围
function formatDateRange(from: string, to: string): string {
  const [fy, fm, fd] = from.split('-')
  const [, tm, td] = to.split('-')
  // 同年同月
  if (fy === to.split('-')[0] && fm === tm) {
    return `${parseInt(fm)}月${parseInt(fd)}–${parseInt(td)}日`
  }
  // 同年跨月
  if (fy === to.split('-')[0]) {
    return `${parseInt(fm)}月${parseInt(fd)}日–${parseInt(tm)}月${parseInt(td)}日`
  }
  // 跨年
  return `${fy}.${fm}.${fd}–${to.slice(0, 10)}`
}

export default function SummaryListItem({ summary, isSelected, onSelect }: SummaryListItemProps) {
  const [propOpen, setPropOpen] = useState(false)
  const propRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLDivElement>(null)

  // 点击外部关闭文档属性浮层
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        propRef.current && !propRef.current.contains(e.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(e.target as Node)
      ) {
        setPropOpen(false)
      }
    }
    if (propOpen) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [propOpen])

  const typeLabel = TYPE_LABELS[summary.summary_type] ?? '总结'
  const dateRange = formatDateRange(summary.date_from, summary.date_to)
  const dimNames: string[] = (summary.data_sources as { dimension_names?: string[] })?.dimension_names ?? []

  return (
    <div style={{ position: 'relative' }}>
      {/* 主条目 */}
      <div
        onClick={onSelect}
        style={{
          padding: '10px 14px',
          cursor: 'pointer',
          background: isSelected ? '#F0FBF7' : 'transparent',
          borderLeft: isSelected ? '2px solid #1D9E75' : '2px solid transparent',
        }}
        onMouseEnter={e => {
          if (!isSelected)
            (e.currentTarget as HTMLDivElement).style.background = '#F4F3F0'
        }}
        onMouseLeave={e => {
          if (!isSelected)
            (e.currentTarget as HTMLDivElement).style.background = 'transparent'
        }}
      >
        {/* 第一行：徽章 + 标题 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
          {/* 草稿/定稿徽章 */}
          <span style={{
            fontSize: 10,
            padding: '1px 5px',
            borderRadius: 3,
            background: summary.is_draft ? '#FFFBEB' : '#F0FBF7',
            color: summary.is_draft ? '#92400E' : '#0F6E56',
            border: `1px solid ${summary.is_draft ? '#FDE68A' : '#9FE1CB'}`,
            flexShrink: 0,
          }}>
            {summary.is_draft ? '草稿' : '定稿'}
          </span>
          <span style={{
            fontSize: 13,
            color: isSelected ? '#0F6E56' : '#1A1A1A',
            fontWeight: isSelected ? 500 : 400,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {summary.title ?? `${typeLabel} · ${formatShortDate(summary.date_from)}`}
          </span>
        </div>

        {/* 第二行：时间范围 */}
        <div style={{ fontSize: 11, color: '#B0ADA6', marginBottom: dimNames.length > 0 ? 4 : 0 }}>
          {dateRange}
        </div>

        {/* 第三行：维度标签（最多显示 3 个） */}
        {dimNames.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginBottom: 4 }}>
            {dimNames.slice(0, 3).map((name, i) => (
              <span key={i} style={{
                fontSize: 10,
                padding: '1px 5px',
                background: '#F4F3F0',
                color: '#6B6B6B',
                borderRadius: 3,
                border: '1px solid #E8E4DD',
              }}>
                {name}
              </span>
            ))}
            {dimNames.length > 3 && (
              <span style={{ fontSize: 10, color: '#B0ADA6' }}>+{dimNames.length - 3}</span>
            )}
          </div>
        )}

        {/* 「▸ 文档属性」折叠触发行 */}
        <div
          ref={triggerRef}
          onClick={e => {
            e.stopPropagation()   // 不触发父级 onSelect
            setPropOpen(prev => !prev)
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 11,
            color: propOpen ? '#0F6E56' : '#B0ADA6',
            cursor: 'pointer',
            marginTop: 2,
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLDivElement).style.color = '#0F6E56'
          }}
          onMouseLeave={e => {
            if (!propOpen)
              (e.currentTarget as HTMLDivElement).style.color = '#B0ADA6'
          }}
        >
          <span style={{
            display: 'inline-block',
            transform: propOpen ? 'rotate(90deg)' : 'none',
            transition: 'transform 0.15s ease',
            fontSize: 9,
          }}>▸</span>
          文档属性
        </div>
      </div>

      {/* 文档属性浮层 */}
      {propOpen && (
        <div
          ref={propRef}
          style={{
            position: 'absolute',
            left: '100%',
            top: 0,
            zIndex: 30,
            width: 240,
            background: '#FFFFFF',
            border: '1px solid #E8E4DD',
            borderRadius: 8,
            padding: '12px 14px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
            fontSize: 12,
            color: '#1A1A1A',
            lineHeight: 1.8,
          }}
          onClick={e => e.stopPropagation()}
        >
          <PropertyRow label="时间范围" value={dateRange} />
          <PropertyRow label="报告类型" value={typeLabel} />
          <PropertyRow
            label="职能维度"
            value={dimNames.length > 0 ? dimNames.join('、') : '—'}
          />
          <PropertyRow
            label="汇报框架"
            value={summary.report_node_id ? '已套用' : '未套用（自由生成）'}
          />
          <PropertyRow
            label="数据来源"
            value={formatDataSources(summary.data_sources)}
          />
          {summary.finalized_at && (
            <PropertyRow
              label="定稿时间"
              value={summary.finalized_at.slice(0, 10)}
            />
          )}
        </div>
      )}
    </div>
  )
}

function PropertyRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 2 }}>
      <span style={{ color: '#B0ADA6', flexShrink: 0, minWidth: 60 }}>{label}</span>
      <span style={{ color: '#1A1A1A', wordBreak: 'break-all' }}>{value}</span>
    </div>
  )
}

function formatDataSources(sources: Summary['data_sources']): string {
  const parts: string[] = []
  const used = (sources as { summaries_used?: string[] })?.summaries_used
  if (used && used.length > 0) {
    parts.push(`${used.length} 篇定稿报告`)
  }
  const count = (sources as { logs_count?: number })?.logs_count
  if (count !== undefined && count > 0) {
    parts.push(`${count} 条日志`)
  }
  return parts.length > 0 ? parts.join(' + ') : '—'
}
```

---

### 6. 添加 PROMPTS.summary_assistant 占位

**修改 `/lib/prompts.ts`**，追加 summary_assistant（完整版在 Task 17 完善）：

```typescript
summary_assistant: `
你是用户工作总结的润色顾问。

【当前总结内容（Markdown）】
{current_content}

【你的任务】
用户会告诉你想改哪个章节或哪段内容，你给出替换建议。

【规则】
- 只改用户指定的部分，不动其他内容
- 不编造新事实，只优化表达
- 给出替换建议时，明确指出是哪一段

【替换建议输出格式】严格按以下 JSON：
{
  "type": "replace_suggestion",
  "target_section": "「需求分析」第二段",
  "original": "原文内容（完整复制，用于前端匹配）",
  "replacement": "替换后的内容"
}

如果用户只是聊天没有明确要替换，正常文字回复即可，不输出 JSON。
`.trim(),
```

---

### 7. 为 /summary 创建 API Route 占位（Task 17 完善）

**创建 `app/api/summary/ai-chat/route.ts`**

先建好结构，Task 17 再完善替换逻辑：

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { callAI } from '@/lib/ai'
import { AiMessage } from '@/types'
import { PROMPTS } from '@/lib/prompts'

export async function POST(req: NextRequest) {
  try {
    const {
      messages,
      currentContent,
    }: {
      messages: AiMessage[]
      currentContent: string
    } = await req.json()

    const systemPrompt = PROMPTS.summary_assistant
      .replace('{current_content}', currentContent || '（未提供总结内容）')

    const content = await callAI(
      messages.map(m => ({ role: m.role, content: m.content })),
      systemPrompt
    )

    // 尝试解析是否为 replace_suggestion JSON
    let replaceSuggestion = null
    try {
      const parsed = JSON.parse(content)
      if (parsed?.type === 'replace_suggestion') replaceSuggestion = parsed
    } catch {
      // 普通对话文字，忽略
    }

    return NextResponse.json({ content, replaceSuggestion })
  } catch {
    return NextResponse.json(
      { error: 'AI 服务暂时不可用，请稍后重试' },
      { status: 500 }
    )
  }
}
```

---

## 不做什么

```
❌ 新建总结弹窗（Task 14 做）
❌ AI 生成总结（Task 15 做）
❌ Markdown 编辑/预览（Task 16 做）
❌ 操作栏（恢复上版 / 存为定稿，Task 16 做）
❌ AI 替换建议卡片（Task 17 做）
❌ 选中后右栏展示真实内容（Task 16 实现，现在只展示占位文字）
❌ summaries 表中 dimension_names 字段的真实写入（Task 15 生成时写入）
```

---

## 完成标准

```
□ 访问 /summary → 正确显示页面（Sidebar「汇报总结」高亮）
□ 左侧列表宽 220px，右侧内容区 flex-1
□ 数据库有总结数据时：左侧列表按月分组展示（── 2026年4月 ──）
□ 每条总结显示：草稿/定稿徽章 + 标题 + 时间范围
□ 有 dimension_names 数据时：显示维度标签（最多 3 个）
□ 每条总结底部有「▸ 文档属性」入口
□ 点「▸ 文档属性」→ 浮层弹出（在条目右侧），显示时间范围/类型/维度/数据来源字段
□ 点浮层外部 → 浮层关闭
□ 无选中时：右侧居中显示 ◫ 图标 + 提示文字
□ 数据库无总结时：左侧显示「还没有总结记录。点击「+ 新建」生成第一份。」
□ 列表顶部「+ 新建」按钮存在（点击暂无响应，Task 14 实现）
□ 「✦ AI 助手」按钮可打开/关闭面板，面板复用 AiSidePanel
□ 无选中时 AI 面板 contextLabel 显示「请先选择一份总结」
□ 无 TypeScript 报错
□ npm run dev 无报错
```

---

## 做完后告诉我

1. 做了哪些文件
2. 历史总结按月分组是否正确（月份标题显示对了吗）
3. 文档属性浮层定位是否正确（在条目右侧，不超出视口）
4. 不要自动开始 task 14，等我验收

---

*Task 13 | 2026.04.24*
