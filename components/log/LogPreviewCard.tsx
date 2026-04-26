'use client'
import { useState } from 'react'
import { LogPreview } from '@/types'

interface LogPreviewCardProps {
  data: LogPreview
  onAdopt: () => void
}

export default function LogPreviewCard({ data, onAdopt }: LogPreviewCardProps) {
  const [adopted, setAdopted] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  return (
    <div
      style={{
        background: '#F0FBF7',
        border: '1px solid #9FE1CB',
        borderRadius: 8,
        overflow: 'hidden',
        alignSelf: 'flex-start',
        maxWidth: '90%',
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
        ✦ AI 整理结果 · {data.items.length} 条
      </div>

      {/* 预览条目 */}
      <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {data.items.map((item, i) => (
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
              {item.dimension_name}
            </div>
            <div style={{ fontSize: 12, color: '#1A1A1A', lineHeight: 1.7 }}>
              {item.content}
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
            onClick={() => { setAdopted(true); onAdopt() }}
            style={{
              flex: 1,
              padding: '5px 0',
              background: '#1D9E75',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            采纳，填入记录
          </button>
          <button
            onClick={() => setDismissed(true)}
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
