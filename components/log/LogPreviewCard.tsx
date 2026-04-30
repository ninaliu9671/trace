'use client'
import { LogPreview } from '@/types'

interface LogPreviewCardProps {
  data: LogPreview
  adopted?: boolean
  discarded?: boolean
  onAdopt: () => void
  onDiscard: () => void
}

export default function LogPreviewCard({ data, adopted = false, discarded = false, onAdopt, onDiscard }: LogPreviewCardProps) {
  const safeItems = Array.isArray(data?.items)
    ? data.items.filter(item =>
        Boolean(
          (item?.dimension_name && String(item.dimension_name).trim()) ||
          (item?.content && String(item.content).trim())
        )
      )
    : []

  if (discarded) return null

  return (
    <div
      style={{
        background: '#F0FBF7',
        borderWidth: 1,
        borderStyle: 'solid',
        borderColor: '#9FE1CB',
        borderRadius: 8,
        overflow: 'hidden',
        alignSelf: 'flex-start',
        width: '100%',
        maxWidth: '100%',
        boxSizing: 'border-box',
        minHeight: 88,
      }}
    >
      {/* 标题 */}
      <div
        style={{
          padding: '8px 12px',
          borderBottom: '1px solid #E8F7F2',
          fontSize: 12,
          fontWeight: 500,
          color: '#0F6E56',
        }}
      >
        ✦ AI 整理结果 · {safeItems.length} 条
      </div>

      {/* 预览条目 */}
      <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {safeItems.length === 0 && (
          <div style={{ fontSize: 12, color: '#6B6B6B', lineHeight: 1.7 }}>
            本次整理结果为空，请让我重新整理一版后再确认。
          </div>
        )}
        {safeItems.map((item, i) => (
          <div key={i}>
            <div
              style={{
                display: 'inline-block',
                fontSize: 11,
                color: '#0F6E56',
                background: '#DCF5EC',
                borderRadius: 4,
                padding: '1px 6px',
                marginBottom: 4,
              }}
            >
              {item.dimension_name || '未命名维度'}
            </div>
            <div style={{ fontSize: 12, color: '#1A1A1A', lineHeight: 1.7 }}>
              {item.content || '（无内容）'}
            </div>
          </div>
        ))}
      </div>

      {/* 操作按钮 */}
      {!adopted && (
        <div
          style={{
            padding: '8px 12px',
            borderTop: '1px solid #E8F7F2',
            display: 'flex',
            gap: 8,
          }}
        >
          <button
            onClick={onAdopt}
            disabled={safeItems.length === 0}
            style={{
              flex: 1,
              padding: '5px 0',
              background: safeItems.length > 0 ? '#1D9E75' : '#C7C7C7',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 500,
              cursor: safeItems.length > 0 ? 'pointer' : 'not-allowed',
            }}
          >
            采纳，填入记录
          </button>
          <button
            onClick={onDiscard}
            style={{
              padding: '5px 10px',
              background: 'transparent',
              color: '#B0ADA6',
              border: '1px solid #E8E4DD',
              borderRadius: 6,
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            不采纳
          </button>
        </div>
      )}

      {/* 已采纳状态 */}
      {adopted && (
        <div
          style={{
            padding: '8px 12px',
            borderTop: '1px solid #E8F7F2',
            fontSize: 12,
            color: '#9FE1CB',
            lineHeight: 1.6,
          }}
        >
          ✓ 已填入记录 · 可直接编辑字段，或继续告诉 AI 调整（AI 会整体替换）
        </div>
      )}
    </div>
  )
}
