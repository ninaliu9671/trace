'use client'
import { useState, useEffect } from 'react'
import { Dimension, ReportNode, NewSummaryParams } from '@/types'
import { createClient } from '@/lib/supabase/client'
import {
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

const PRESET_TO_TYPE: Record<DatePreset, SummaryType | null> = {
  week:    'weekly',
  month:   'monthly',
  quarter: 'quarterly',
  custom:  null,
}

const GRANULARITY_TO_TYPE: Record<string, SummaryType> = {
  weekly: 'weekly',
  monthly: 'monthly',
  quarterly: 'quarterly',
  annual: 'annual',
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
  const [reportNodes, setReportNodes] = useState<ReportNode[]>([])
  const [selectedReportNodeId, setSelectedReportNodeId] = useState<string | null>(null)
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

  // 拉取可用汇报框架节点（职业档案中已配置）
  useEffect(() => {
    async function fetchReportNodes() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('report_nodes')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('sort_order')

      const nodes = (data ?? []) as ReportNode[]
      setReportNodes(nodes)

      if (nodes.length > 0) {
        setSelectedReportNodeId(prev => prev ?? nodes[0].id)
      }
    }
    fetchReportNodes()
  }, [])

  function handlePresetChange(preset: DatePreset) {
    setDatePreset(preset)
    const defaultType = PRESET_TO_TYPE[preset]
    if (defaultType) {
      setSummaryType(defaultType)
      if (reportNodes.length > 0) {
        const preferred = reportNodes.find(
          n => n.time_granularity && GRANULARITY_TO_TYPE[n.time_granularity] === defaultType
        )
        if (preferred) setSelectedReportNodeId(preferred.id)
      }
    }
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
    if (!selectedReportNodeId) {
      setError('请选择一个汇报框架（请先在职业档案中配置）')
      return
    }

    setSubmitting(true)
    setError(null)
    onSubmit({
      dateFrom: range.from,
      dateTo: range.to,
      summaryType,
      dimensionIds: selectedDimIds,
      reportNodeId: selectedReportNodeId,
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

          {/* 汇报框架 */}
          <Section label="汇报框架" required>
            {reportNodes.length === 0 ? (
              <div style={{ fontSize: 12, color: '#B0ADA6' }}>暂无可用汇报框架，请先在职业档案中配置。</div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {reportNodes.map(node => {
                  const checked = selectedReportNodeId === node.id
                  const granularity = node.time_granularity ?? 'custom'
                  return (
                    <button
                      key={node.id}
                      onClick={() => {
                        setSelectedReportNodeId(node.id)
                        if (granularity in GRANULARITY_TO_TYPE) {
                          setSummaryType(GRANULARITY_TO_TYPE[granularity])
                        } else {
                          setSummaryType('adhoc')
                        }
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
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
                      <span>{node.name}</span>
                      {checked && <span style={{ fontSize: 10 }}>✓</span>}
                    </button>
                  )
                })}
              </div>
            )}
          </Section>

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
            disabled={submitting || !selectedReportNodeId}
            style={{
              padding: '8px 18px',
              border: 'none', borderRadius: 7,
              background: submitting || !selectedReportNodeId ? '#6B6B6B' : '#1A1A1A',
              color: '#FFFFFF',
              fontSize: 13, fontWeight: 500,
              cursor: submitting || !selectedReportNodeId ? 'default' : 'pointer',
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
