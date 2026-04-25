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
  onSubmit: (params: NewSummaryParams) => void
}

type DatePreset = 'week' | 'month' | 'quarter' | 'custom'
type SummaryType = 'weekly' | 'monthly' | 'quarterly' | 'annual' | 'adhoc'

const PRESET_LABELS: Record<DatePreset, string> = {
  week:    '本周',
  month:   '本月',
  quarter: '本季度',
  custom:  '自定义',
}

const TYPE_OPTIONS: { value: SummaryType; label: string }[] = [
  { value: 'weekly',    label: '周报' },
  { value: 'monthly',   label: '月报' },
  { value: 'quarterly', label: '季报' },
  { value: 'annual',    label: '年报/述职' },
  { value: 'adhoc',     label: '临时汇报' },
]

const PRESET_TO_TYPE: Record<DatePreset, SummaryType | null> = {
  week:    'weekly',
  month:   'monthly',
  quarter: 'quarterly',
  custom:  null,
}

const TYPE_GRANULARITY: Record<string, string | null> = {
  weekly:    'weekly',
  monthly:   'monthly',
  quarterly: 'quarterly',
  annual:    'annual',
  adhoc:     null,
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

export default function NewSummaryModal({ onClose, onSubmit }: NewSummaryModalProps) {
  const [datePreset, setDatePreset] = useState<DatePreset>('week')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [summaryType, setSummaryType] = useState<SummaryType>('weekly')
  const [selectedDimIds, setSelectedDimIds] = useState<string[]>([])
  const [dimensions, setDimensions] = useState<Dimension[]>([])
  const [matchedNode, setMatchedNode] = useState<ReportNode | null>(null)
  const [useTemplate, setUseTemplate] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 拉取一级维度
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
      setSelectedDimIds(dims.map((d: Dimension) => d.id))
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

  function handlePresetChange(preset: DatePreset) {
    setDatePreset(preset)
    const defaultType = PRESET_TO_TYPE[preset]
    if (defaultType) setSummaryType(defaultType)
  }

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

          {/* 报告类型 */}
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
          {matchedNode && useTemplate && (
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
