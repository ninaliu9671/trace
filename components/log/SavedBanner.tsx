import { formatSavedAt } from '@/lib/utils'

interface SavedBannerProps {
  savedAt: string
  onEdit: () => void
}

export default function SavedBanner({ savedAt, onEdit }: SavedBannerProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '9px 24px',
        background: '#F0FBF7',
        borderBottom: '1px solid #9FE1CB',
        flexShrink: 0,
      }}
    >
      <span style={{ fontSize: 13, color: '#0F6E56' }}>
        ✓ 本日记录已保存 · {formatSavedAt(savedAt)}
      </span>
      <button
        onClick={onEdit}
        style={{
          fontSize: 12,
          color: '#0F6E56',
          background: 'transparent',
          border: '1px solid #9FE1CB',
          borderRadius: 6,
          padding: '3px 12px',
          cursor: 'pointer',
        }}
      >
        编辑
      </button>
    </div>
  )
}
