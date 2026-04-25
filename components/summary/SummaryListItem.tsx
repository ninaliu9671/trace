'use client'
import { useState, useRef, useEffect } from 'react'
import { Summary } from '@/types'

interface SummaryListItemProps {
  summary: Summary
  isSelected: boolean
  onSelect: () => void
}

const TYPE_LABELS: Record<Summary['summary_type'], string> = {
  weekly: '周报',
  monthly: '月报',
  quarterly: '季报',
  annual: '年报',
  adhoc: '临时',
}

function formatShortDate(dateStr: string): string {
  const [, m, d] = dateStr.split('-')
  return `${parseInt(m)}月${parseInt(d)}日`
}

function formatDateRange(from: string, to: string): string {
  const [fy, fm, fd] = from.split('-')
  const [ty, tm, td] = to.split('-')
  if (fy === ty && fm === tm) {
    return `${parseInt(fm)}月${parseInt(fd)}–${parseInt(td)}日`
  }
  if (fy === ty) {
    return `${parseInt(fm)}月${parseInt(fd)}日–${parseInt(tm)}月${parseInt(td)}日`
  }
  return `${fy}.${fm}.${fd}–${to.slice(0, 10)}`
}

function formatDataSources(sources: Summary['data_sources']): string {
  const parts: string[] = []
  if (sources?.summaries_used && sources.summaries_used.length > 0) {
    parts.push(`${sources.summaries_used.length} 篇定稿报告`)
  }
  if (sources?.logs_count !== undefined && sources.logs_count > 0) {
    parts.push(`${sources.logs_count} 条日志`)
  }
  return parts.length > 0 ? parts.join(' + ') : '—'
}

function PropertyRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 2 }}>
      <span style={{ color: '#B0ADA6', flexShrink: 0, minWidth: 60 }}>{label}</span>
      <span style={{ color: '#1A1A1A', wordBreak: 'break-all' }}>{value}</span>
    </div>
  )
}

export default function SummaryListItem({ summary, isSelected, onSelect }: SummaryListItemProps) {
  const [propOpen, setPropOpen] = useState(false)
  const propRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLDivElement>(null)

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
  const dimNames: string[] = summary.data_sources?.dimension_names ?? []

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
            e.stopPropagation()
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
