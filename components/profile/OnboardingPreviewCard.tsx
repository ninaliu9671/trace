'use client'

import { useState } from 'react'
import { OnboardingResult } from '@/types'

interface OnboardingPreviewCardProps {
  data: OnboardingResult
  confirmed?: boolean
  onConfirm: () => Promise<void>
}

export default function OnboardingPreviewCard({ data, confirmed: confirmedProp, onConfirm }: OnboardingPreviewCardProps) {
  const [confirming, setConfirming] = useState(false)
  const [confirmedLocal, setConfirmedLocal] = useState(false)

  const confirmed = confirmedProp ?? confirmedLocal

  async function handleConfirm() {
    setConfirming(true)
    await onConfirm()
    setConfirmedLocal(true)
    setConfirming(false)
  }

  const nodeNames = data.report_nodes.slice(0, 4).map(n => n.name).join(' → ')
  const dimNames = data.dimensions.slice(0, 4).map(d => `${d.icon} ${d.name}`)

  return (
    <div
      style={{
        background: '#F0FBF7',
        border: '1px solid #9FE1CB',
        borderRadius: 8,
        padding: 14,
        fontSize: 13,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <div style={{ fontWeight: 500, color: '#0F6E56', fontSize: 13 }}>
        ✦ AI 已帮你设计好了框架
      </div>

      {/* 汇报框架预览 */}
      <div>
        <div
          style={{
            fontSize: 11,
            fontWeight: 500,
            color: '#B0ADA6',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            marginBottom: 6,
          }}
        >
          汇报框架（{data.report_nodes.length} 个节点）
        </div>
        <div style={{ fontSize: 12, color: '#1A1A1A', lineHeight: 1.6 }}>
          · {nodeNames}
        </div>
      </div>

      {/* 记录维度预览 */}
      <div>
        <div
          style={{
            fontSize: 11,
            fontWeight: 500,
            color: '#B0ADA6',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            marginBottom: 6,
          }}
        >
          记录维度（{data.dimensions.length} 个维度）
        </div>
        <div
          style={{
            fontSize: 12,
            color: '#1A1A1A',
            lineHeight: 1.8,
            display: 'flex',
            flexWrap: 'wrap',
            gap: '2px 12px',
          }}
        >
          {dimNames.map((name, i) => (
            <span key={i}>· {name}</span>
          ))}
        </div>
      </div>

      {/* 确认按钮 */}
      <button
        onClick={handleConfirm}
        disabled={confirming || confirmed}
        style={{
          width: '100%',
          padding: '8px 0',
          background: confirmed ? '#1D9E75' : confirming ? '#6B6B6B' : '#1D9E75',
          color: '#FFFFFF',
          border: 'none',
          borderRadius: 7,
          fontSize: 13,
          fontWeight: 500,
          cursor: confirming || confirmed ? 'default' : 'pointer',
        }}
      >
        {confirmed ? '✓ 已保存到档案' : confirming ? '保存中...' : '✓ 确认，保存到档案'}
      </button>

      {!confirmed && (
        <div style={{ fontSize: 12, color: '#6B6B6B', textAlign: 'center' }}>
          还想调整什么，继续和我说
        </div>
      )}
    </div>
  )
}
