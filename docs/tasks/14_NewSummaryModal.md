# Task 14 · NewSummaryModal + 数据完整度检查

> 完成本 task 后再开始 task 15。
> 完成标准：「+ 新建」弹窗各参数可选择，点「生成总结」后正确触发完整度检查，两种操作路径（先去补写 / 直接生成）均可走通，无 TS 报错。

---

## 前置要求

- Task 13 已完成并验收通过
- `dimensions` 表、`summaries` 表、`daily_logs` 表已在 Supabase 中建好
- `report_nodes` 表已在 Supabase 中建好
- `NewSummaryParams` 类型已在 `/types/index.ts` 定义（Task 13 已写）

---

## 这次要做什么

### 1. 新增类型

**修改 `/types/index.ts`**，追加完整度检查相关类型：

```typescript
export interface CompletenessResult {
  completeness: 'complete' | 'partial' | 'logs_only'
  found_summaries: {
    type: string         // 'weekly' | 'monthly' 等
    count: number
    label: string        // '3 篇月报定稿（1月、3月、7月）'
  }[]
  missing_types: {
    type: string
    label: string        // '季报缺失（将用月报 + 日志补充）'
  }[]
  logs_count: number
}
```

---

### 2. 工具函数：日期范围计算

**追加到 `lib/utils.ts`**：

```typescript
// 获取本周一到本周日（ISO 周，周一为第一天）
export function getThisWeekRange(): { from: string; to: string } {
  const today = new Date()
  const day = today.getDay()                          // 0=日，1=一...
  const diffToMonday = day === 0 ? -6 : 1 - day       // 调整到周一
  const monday = new Date(today)
  monday.setDate(today.getDate() + diffToMonday)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  return { from: toDateString(monday), to: toDateString(sunday) }
}

// 获取本月第一天到最后一天
export function getThisMonthRange(): { from: string; to: string } {
  const today = new Date()
  const y = today.getFullYear()
  const m = today.getMonth()
  const first = new Date(y, m, 1)
  const last = new Date(y, m + 1, 0)
  return { from: toDateString(first), to: toDateString(last) }
}

// 获取本季度第一天到最后一天
export function getThisQuarterRange(): { from: string; to: string } {
  const today = new Date()
  const y = today.getFullYear()
  const q = Math.floor(today.getMonth() / 3)         // 0=Q1，1=Q2...
  const firstMonth = q * 3
  const lastMonth = firstMonth + 2
  const first = new Date(y, firstMonth, 1)
  const last = new Date(y, lastMonth + 1, 0)
  return { from: toDateString(first), to: toDateString(last) }
}
```

---

### 3. API Route：POST /api/summary/check-completeness

**创建 `app/api/summary/check-completeness/route.ts`**

根据报告类型查找时间范围内已有的定稿报告，并统计日志数量：

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createSessionClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

// 生成高优先级报告类型（按 spec 11.1 的 priorityMap）
const priorityMap: Record<string, string[]> = {
  annual:    ['quarterly', 'monthly', 'weekly'],
  quarterly: ['monthly', 'weekly'],
  monthly:   ['weekly'],
  weekly:    [],
  adhoc:     [],
}

const TYPE_LABELS: Record<string, string> = {
  weekly: '周报',
  monthly: '月报',
  quarterly: '季报',
  annual: '年报',
  adhoc: '临时汇报',
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
        // 生成月份列表描述（最多显示 3 个月份）
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

    // 判断完整度
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
```

---

### 4. NewSummaryModal 组件

**创建 `components/summary/NewSummaryModal.tsx`**

500px 宽，居中，blur 遮罩：

```typescript
'use client'
import { useState, useEffect } from 'react'
import { Dimension, ReportNode, NewSummaryParams } from '@/types'
import { createClient } from '@/lib/supabase/client'
import {
  toDateString,
  getThisWeekRange,
  getThisMonthRange,
  getThisQuarterRange,
} from '@/lib/utils'

interface NewSummaryModalProps {
  onClose: () => void
  onSubmit: (params: NewSummaryParams) => void   // SummaryPage 接收，触发完整度检查
}

type DatePreset = 'week' | 'month' | 'quarter' | 'custom'

type SummaryType = 'weekly' | 'monthly' | 'quarterly' | 'annual' | 'adhoc'

const PRESET_LABELS: Record<DatePreset, string> = {
  week: '本周',
  month: '本月',
  quarter: '本季度',
  custom: '自定义',
}

const TYPE_OPTIONS: { value: SummaryType; label: string }[] = [
  { value: 'weekly',    label: '周报' },
  { value: 'monthly',   label: '月报' },
  { value: 'quarterly', label: '季报' },
  { value: 'annual',    label: '年报/述职' },
  { value: 'adhoc',     label: '临时汇报' },
]

// 预设与报告类型的默认映射
const PRESET_TO_TYPE: Record<DatePreset, SummaryType | null> = {
  week:    'weekly',
  month:   'monthly',
  quarter: 'quarterly',
  custom:  null,
}

export default function NewSummaryModal({ onClose, onSubmit }: NewSummaryModalProps) {
  const [datePreset, setDatePreset] = useState<DatePreset>('week')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [summaryType, setSummaryType] = useState<SummaryType>('weekly')
  const [selectedDimIds, setSelectedDimIds] = useState<string[]>([])
  const [dimensions, setDimensions] = useState<Dimension[]>([])      // level-1 维度
  const [matchedNode, setMatchedNode] = useState<ReportNode | null>(null)   // 检测到的汇报框架
  const [useTemplate, setUseTemplate] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 拉取一级维度（用于多选）
  useEffect(() => {
    async function fetchDimensions() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('dimensions')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .eq('level', 1)
        .order('sort_order')

      const dims = data ?? []
      setDimensions(dims)
      // 默认全选
      setSelectedDimIds(dims.map(d => d.id))
    }
    fetchDimensions()
  }, [])

  // 根据报告类型检测匹配的汇报框架节点
  useEffect(() => {
    async function detectTemplate() {
      const granularity = TYPE_GRANULARITY[summaryType]
      if (!granularity) { setMatchedNode(null); return }

      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('report_nodes')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .eq('time_granularity', granularity)
        .limit(1)
        .single()

      setMatchedNode(data ?? null)
      if (data) setUseTemplate(true)
    }
    detectTemplate()
  }, [summaryType])

  // 切预设时自动设置报告类型
  function handlePresetChange(preset: DatePreset) {
    setDatePreset(preset)
    const defaultType = PRESET_TO_TYPE[preset]
    if (defaultType) setSummaryType(defaultType)
  }

  // 计算当前日期范围
  function getDateRange(): { from: string; to: string } | null {
    if (datePreset === 'week')    return getThisWeekRange()
    if (datePreset === 'month')   return getThisMonthRange()
    if (datePreset === 'quarter') return getThisQuarterRange()
    if (customFrom && customTo)   return { from: customFrom, to: customTo }
    return null
  }

  async function handleSubmit() {
    const range = getDateRange()
    if (!range) {
      setError('请填写完整的日期范围')
      return
    }
    if (selectedDimIds.length === 0) {
      setError('请至少选择一个职能维度')
      return
    }

    setSubmitting(true)
    setError(null)
    onSubmit({
      dateFrom: range.from,
      dateTo: range.to,
      summaryType,
      dimensionIds: selectedDimIds,
      reportNodeId: useTemplate && matchedNode ? matchedNode.id : null,
    })
  }

  function toggleDimension(id: string) {
    setSelectedDimIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  const dateRange = getDateRange()

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50,
      background: 'rgba(0,0,0,0.2)',
      backdropFilter: 'blur(3px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: '#FFFFFF',
        border: '1px solid #E8E4DD',
        borderRadius: 12,
        width: 500,
        maxWidth: 'calc(100vw - 32px)',
        maxHeight: 'calc(100vh - 48px)',
        overflowY: 'auto',
        boxShadow: '0 16px 48px rgba(0,0,0,0.12)',
      }}>
        {/* 弹窗头部 */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 20px 14px',
          borderBottom: '1px solid #F0EDE8',
        }}>
          <span style={{ fontSize: 15, fontWeight: 500, color: '#1A1A1A' }}>新建工作总结</span>
          <button
            onClick={onClose}
            style={{
              width: 28, height: 28, borderRadius: '50%',
              border: 'none', background: 'transparent',
              cursor: 'pointer', fontSize: 16, color: '#6B6B6B',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            ×
          </button>
        </div>

        {/* 弹窗内容 */}
        <div style={{ padding: '20px' }}>

          {/* 时间范围 */}
          <Section label="时间范围" required>
            <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
              {(Object.keys(PRESET_LABELS) as DatePreset[]).map(preset => (
                <button
                  key={preset}
                  onClick={() => handlePresetChange(preset)}
                  style={{
                    padding: '5px 12px',
                    border: `1px solid ${datePreset === preset ? '#1D9E75' : '#E8E4DD'}`,
                    borderRadius: 6,
                    background: datePreset === preset ? '#F0FBF7' : 'transparent',
                    color: datePreset === preset ? '#0F6E56' : '#6B6B6B',
                    fontSize: 12,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  {PRESET_LABELS[preset]}
                </button>
              ))}
            </div>

            {/* 自定义日期输入 */}
            {datePreset === 'custom' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="date"
                  value={customFrom}
                  onChange={e => setCustomFrom(e.target.value)}
                  style={dateInputStyle}
                />
                <span style={{ fontSize: 12, color: '#B0ADA6' }}>至</span>
                <input
                  type="date"
                  value={customTo}
                  onChange={e => setCustomTo(e.target.value)}
                  min={customFrom}
                  style={dateInputStyle}
                />
              </div>
            )}

            {/* 非自定义时显示计算后的日期范围 */}
            {datePreset !== 'custom' && dateRange && (
              <div style={{ fontSize: 11, color: '#B0ADA6', marginTop: 4 }}>
                {dateRange.from} 至 {dateRange.to}
              </div>
            )}
          </Section>

          {/* 职能维度 */}
          <Section label="职能维度" required>
            {dimensions.length === 0 ? (
              <div style={{ fontSize: 12, color: '#B0ADA6' }}>加载中...</div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {dimensions.map(dim => {
                  const checked = selectedDimIds.includes(dim.id)
                  return (
                    <button
                      key={dim.id}
                      onClick={() => toggleDimension(dim.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 4,
                        padding: '5px 10px',
                        border: `1px solid ${checked ? '#1D9E75' : '#E8E4DD'}`,
                        borderRadius: 6,
                        background: checked ? '#F0FBF7' : 'transparent',
                        color: checked ? '#0F6E56' : '#6B6B6B',
                        fontSize: 12,
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}
                    >
                      <span>{dim.icon ?? '📋'}</span>
                      <span>{dim.name}</span>
                      {checked && <span style={{ fontSize: 10 }}>✓</span>}
                    </button>
                  )
                })}
              </div>
            )}
          </Section>

          {/* 报告类型（选填） */}
          <Section label="报告类型" optional>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {TYPE_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setSummaryType(opt.value)}
                  style={{
                    padding: '5px 12px',
                    border: `1px solid ${summaryType === opt.value ? '#1D9E75' : '#E8E4DD'}`,
                    borderRadius: 6,
                    background: summaryType === opt.value ? '#F0FBF7' : 'transparent',
                    color: summaryType === opt.value ? '#0F6E56' : '#6B6B6B',
                    fontSize: 12,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </Section>

          {/* 汇报框架模板检测提示 */}
          {matchedNode && (
            <div style={{
              border: '1px solid #9FE1CB',
              borderRadius: 8,
              background: '#F0FBF7',
              padding: '10px 14px',
              marginBottom: 20,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
            }}>
              <div style={{ fontSize: 12, color: '#0F6E56' }}>
                <span style={{ marginRight: 6 }}>✦</span>
                将套用「{matchedNode.name}」生成
              </div>
              <button
                onClick={() => setUseTemplate(false)}
                style={{
                  fontSize: 11, color: '#B0ADA6',
                  background: 'transparent', border: 'none',
                  cursor: 'pointer', flexShrink: 0, padding: 0,
                }}
              >
                不套用
              </button>
            </div>
          )}

          {/* 错误提示 */}
          {error && (
            <div style={{
              fontSize: 12, color: '#B91C1C',
              background: '#FFF0F0', border: '1px solid #F87171',
              borderRadius: 6, padding: '8px 12px', marginBottom: 12,
            }}>
              {error}
            </div>
          )}
        </div>

        {/* 弹窗底部按钮 */}
        <div style={{
          display: 'flex', justifyContent: 'flex-end', gap: 8,
          padding: '14px 20px',
          borderTop: '1px solid #F0EDE8',
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 18px',
              border: '1px solid #E8E4DD', borderRadius: 7,
              background: 'transparent', color: '#6B6B6B',
              fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            style={{
              padding: '8px 18px',
              border: 'none', borderRadius: 7,
              background: submitting ? '#6B6B6B' : '#1A1A1A',
              color: '#FFFFFF',
              fontSize: 13, fontWeight: 500,
              cursor: submitting ? 'default' : 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {submitting ? '检查中...' : '生成总结'}
          </button>
        </div>
      </div>
    </div>
  )
}

// 小节标题
function Section({
  label, required, optional, children,
}: {
  label: string
  required?: boolean
  optional?: boolean
  children: React.ReactNode
}) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: '#1A1A1A' }}>{label}</span>
        {required && <span style={{ fontSize: 11, color: '#B91C1C' }}>*</span>}
        {optional && <span style={{ fontSize: 11, color: '#B0ADA6' }}>（选填）</span>}
      </div>
      {children}
    </div>
  )
}

const dateInputStyle: React.CSSProperties = {
  flex: 1,
  padding: '6px 10px',
  fontSize: 12,
  border: '1px solid #E8E4DD',
  borderRadius: 6,
  background: '#FFFFFF',
  color: '#1A1A1A',
  outline: 'none',
  fontFamily: 'inherit',
}

// 报告类型 → time_granularity 的映射（用于查汇报框架节点）
const TYPE_GRANULARITY: Record<string, string | null> = {
  weekly:    'weekly',
  monthly:   'monthly',
  quarterly: 'quarterly',
  annual:    'annual',
  adhoc:     null,
}
```

---

### 5. DataCompletenessAlert 组件

**创建 `components/summary/DataCompletenessAlert.tsx`**

在完整度检查有缺失时弹出（叠在 NewSummaryModal 关闭后的位置）：

```typescript
'use client'
import { CompletenessResult } from '@/types'

interface DataCompletenessAlertProps {
  result: CompletenessResult
  onProceed: () => void     // 「直接生成」
  onCancel: () => void      // 「先去补写」→ 关闭，用户回到日志页
}

export default function DataCompletenessAlert({
  result, onProceed, onCancel,
}: DataCompletenessAlertProps) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50,
      background: 'rgba(0,0,0,0.2)',
      backdropFilter: 'blur(3px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: '#FFFFFF',
        border: '1px solid #E8E4DD',
        borderRadius: 12,
        width: 420,
        maxWidth: 'calc(100vw - 32px)',
        padding: '24px',
        boxShadow: '0 16px 48px rgba(0,0,0,0.12)',
      }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: '#1A1A1A', marginBottom: 16 }}>
          数据准备情况
        </div>

        {/* 已找到的数据 */}
        <div style={{ marginBottom: 12 }}>
          {result.found_summaries.map((item, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'flex-start', gap: 8,
              fontSize: 13, color: '#1A1A1A', lineHeight: 1.6,
              marginBottom: 6,
            }}>
              <span style={{ color: '#1D9E75', flexShrink: 0, marginTop: 2 }}>✓</span>
              <span>{item.label}</span>
            </div>
          ))}

          {/* 缺失的数据 */}
          {result.missing_types.map((item, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'flex-start', gap: 8,
              fontSize: 13, color: '#6B6B6B', lineHeight: 1.6,
              marginBottom: 6,
            }}>
              <span style={{ color: '#F59E0B', flexShrink: 0, marginTop: 2 }}>✗</span>
              <span>{item.label}</span>
            </div>
          ))}

          {/* 日志数量 */}
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: 8,
            fontSize: 13, color: '#1A1A1A', lineHeight: 1.6,
            marginBottom: 6,
          }}>
            <span style={{ color: '#1D9E75', flexShrink: 0, marginTop: 2 }}>✓</span>
            <span>找到 {result.logs_count} 条日志记录</span>
          </div>
        </div>

        {/* 提示说明 */}
        {result.completeness === 'logs_only' && (
          <div style={{
            fontSize: 12, color: '#B0ADA6',
            background: '#F8F7F4', borderRadius: 6, padding: '8px 12px',
            marginBottom: 20,
          }}>
            数据较少，AI 将直接基于日志生成，可能不够全面。
          </div>
        )}
        {result.completeness === 'partial' && (
          <div style={{
            fontSize: 12, color: '#B0ADA6',
            background: '#F8F7F4', borderRadius: 6, padding: '8px 12px',
            marginBottom: 20,
          }}>
            部分历史定稿缺失，AI 将以现有数据尽量补充完整。
          </div>
        )}

        {/* 操作按钮 */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{
              padding: '8px 16px',
              border: '1px solid #E8E4DD', borderRadius: 7,
              background: 'transparent', color: '#6B6B6B',
              fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            先去补写
          </button>
          <button
            onClick={onProceed}
            style={{
              padding: '8px 16px',
              border: 'none', borderRadius: 7,
              background: '#1A1A1A', color: '#FFFFFF',
              fontSize: 13, fontWeight: 500,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            直接生成
          </button>
        </div>
      </div>
    </div>
  )
}
```

---

### 6. SummaryPage：接入弹窗 + 完整度检查流程

**修改 `app/summary/page.tsx`**，在 Task 13 基础上新增：

#### 新增状态

```typescript
import NewSummaryModal from '@/components/summary/NewSummaryModal'
import DataCompletenessAlert from '@/components/summary/DataCompletenessAlert'
import { CompletenessResult, NewSummaryParams } from '@/types'

const [showNewModal, setShowNewModal] = useState(false)
const [pendingParams, setPendingParams] = useState<NewSummaryParams | null>(null)
const [completenessResult, setCompletenessResult] = useState<CompletenessResult | null>(null)
const [checkingCompleteness, setCheckingCompleteness] = useState(false)
```

#### 处理新建流程

```typescript
// 「+ 新建」按钮点击
function handleNewClick() {
  setShowNewModal(true)
}

// NewSummaryModal 点「生成总结」后的回调
async function handleModalSubmit(params: NewSummaryParams) {
  setShowNewModal(false)
  setCheckingCompleteness(true)
  setPendingParams(params)

  try {
    const res = await fetch('/api/summary/check-completeness', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dateFrom: params.dateFrom,
        dateTo: params.dateTo,
        summaryType: params.summaryType,
      }),
    })
    const data: CompletenessResult = await res.json()
    setCheckingCompleteness(false)

    if (data.completeness === 'complete') {
      // 数据完整，直接进入生成（Task 15 实现）
      handleStartGenerate(params, data)
    } else {
      // 有缺失，弹完整度提示
      setCompletenessResult(data)
    }
  } catch {
    setCheckingCompleteness(false)
    // 网络错误时也直接生成
    if (pendingParams) handleStartGenerate(pendingParams, null)
  }
}

// 进入生成流程（Task 15 实现，现在只占位）
function handleStartGenerate(params: NewSummaryParams, completeness: CompletenessResult | null) {
  setCompletenessResult(null)
  setPendingParams(null)
  // Task 15 实现：启动 Loading + 调 /api/summary/generate
  console.log('开始生成总结', params, completeness)
}
```

#### JSX 中挂载弹窗

```typescript
// 「+ 新建」按钮改为：
onClick={() => handleNewClick()}

// JSX 末尾追加：
{showNewModal && (
  <NewSummaryModal
    onClose={() => setShowNewModal(false)}
    onSubmit={handleModalSubmit}
  />
)}

{/* 完整度检查中的简单 loading 提示（可选，避免界面卡顿感） */}
{checkingCompleteness && (
  <div style={{
    position: 'fixed', inset: 0, zIndex: 45,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'rgba(0,0,0,0.1)',
  }}>
    <div style={{
      background: '#FFFFFF', borderRadius: 10, padding: '16px 24px',
      fontSize: 13, color: '#6B6B6B', border: '1px solid #E8E4DD',
      boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
    }}>
      检查数据中...
    </div>
  </div>
)}

{completenessResult && pendingParams && (
  <DataCompletenessAlert
    result={completenessResult}
    onProceed={() => handleStartGenerate(pendingParams, completenessResult)}
    onCancel={() => {
      setCompletenessResult(null)
      setPendingParams(null)
    }}
  />
)}
```

---

## 不做什么

```
❌ AI 生成总结（Task 15 做，handleStartGenerate 只占位）
❌ Loading 遮罩动画（Task 15 做）
❌ Markdown 编辑器（Task 16 做）
❌ AI 替换建议（Task 17 做）
❌ 总结写入 Supabase（Task 15 做）
❌ 报告类型标签展示在弹窗内（只提供选择，渲染在 Task 16 的 topbar）
```

---

## 完成标准

```
□ 点「+ 新建」→ 500px 弹窗弹出，有 blur 遮罩
□ 时间范围：「本周」「本月」「本季度」「自定义」四个按钮，激活态绿色
□ 选「本周」→ 下方显示计算后的日期范围（如 2026-04-20 至 2026-04-26）
□ 选「自定义」→ 显示两个日期输入框，「至」分隔
□ 职能维度：列出所有一级维度，可多选，选中态绿色高亮
□ 默认全选所有一级维度
□ 报告类型：五种选项，单选，切预设时自动选中对应类型
□ 若该报告类型对应的汇报框架节点存在：显示绿色提示条「将套用 xxx 生成」，右侧「不套用」可点
□ 所有字段为空时点「生成总结」→ 显示错误提示（时间范围/维度校验）
□ 验证通过后点「生成总结」→ 弹窗关闭，出现「检查数据中...」提示
□ 检查结果「complete」→ 直接进入生成（打印 console.log，Task 15 实现真正逻辑）
□ 检查结果「partial/logs_only」→ 关闭 NewSummaryModal，弹出 DataCompletenessAlert
□ DataCompletenessAlert 正确显示找到/缺失的数据（✓/✗ 标记）和日志条数
□ 点「先去补写」→ 两个弹窗都关闭，回到 /summary 主页
□ 点「直接生成」→ 弹窗关闭，进入生成（console.log 占位）
□ 无 TypeScript 报错
□ npm run dev 无报错
```

---

## 做完后告诉我

1. 做了哪些文件
2. 时间范围计算是否正确（「本周」的开始日期是否为周一）
3. 汇报框架模板检测是否正常（有框架节点时是否显示提示条）
4. DataCompletenessAlert 的两个操作路径是否都能走通
5. 不要自动开始 task 15，等我验收

---

*Task 14 | 2026.04.24*
