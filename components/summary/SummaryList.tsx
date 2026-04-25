'use client'
import { Summary } from '@/types'
import SummaryListItem from './SummaryListItem'

interface SummaryListProps {
  summaries: Summary[]
  selectedId: string | null
  onSelect: (id: string) => void
}

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

  // 月份保持倒序（summaries 已按 date_from 倒序，Object.keys 保留插入顺序）
  const months = Object.keys(groups)

  return (
    <div style={{ padding: '8px 0' }}>
      {months.map(month => (
        <div key={month}>
          <div style={{
            padding: '8px 14px 4px',
            fontSize: 11,
            color: '#B0ADA6',
            fontWeight: 500,
            letterSpacing: '0.5px',
          }}>
            ── {month} ──
          </div>

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
