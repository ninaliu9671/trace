'use client'
import { useState } from 'react'
import { ReplaceSuggestion } from '@/types'

interface AiReplaceCardProps {
  data: ReplaceSuggestion
  onAdopt: (original: string, replacement: string) => boolean | void
  onCopy: (replacement: string) => void
  onDismiss: () => void
}

export default function AiReplaceCard({ data, onAdopt, onCopy, onDismiss }: AiReplaceCardProps) {
  const [adopted, setAdopted] = useState(false)
  const [copied, setCopied] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [adoptFailed, setAdoptFailed] = useState(false)

  if (dismissed) return null

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(data.replacement)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // 非 https 环境降级
    }
    onCopy(data.replacement)
  }

  function handleAdopt() {
    const success = onAdopt(data.original, data.replacement) as unknown as boolean
    if (success === false) {
      setAdoptFailed(true)
    } else {
      setAdopted(true)
    }
  }

  return (
    <div style={{
      background: '#FAFAF8',
      border: '1px solid #E8E4DD',
      borderRadius: 8,
      overflow: 'hidden',
      alignSelf: 'flex-start',
      maxWidth: '92%',
    }}>
      {/* 标题 */}
      <div style={{
        padding: '8px 12px',
        borderBottom: '1px solid #F0EDE8',
        fontSize: 12, fontWeight: 500, color: '#6B6B6B',
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <span style={{ color: '#1D9E75' }}>✦</span>
        AI 建议替换 · {data.target_section}
      </div>

      <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* 原文（删除线） */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 500, color: '#B0ADA6', letterSpacing: '0.5px', marginBottom: 4 }}>
            原文
          </div>
          <div style={{ fontSize: 12, color: '#B0ADA6', lineHeight: 1.7, textDecoration: 'line-through', wordBreak: 'break-all' }}>
            {data.original}
          </div>
        </div>

        {/* 替换内容 */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 500, color: '#0F6E56', letterSpacing: '0.5px', marginBottom: 4 }}>
            替换为
          </div>
          <div style={{ fontSize: 12, color: '#1A1A1A', lineHeight: 1.7, wordBreak: 'break-all' }}>
            {data.replacement}
          </div>
        </div>

        {adoptFailed && (
          <div style={{ fontSize: 11, color: '#B91C1C', background: '#FFF0F0', borderRadius: 4, padding: '4px 8px' }}>
            原文已被修改，无法自动替换。请手动复制后粘贴。
          </div>
        )}
      </div>

      {!adopted && (
        <div style={{ padding: '8px 12px', borderTop: '1px solid #F0EDE8', display: 'flex', gap: 6 }}>
          <button
            onClick={handleAdopt}
            style={{
              flex: 1, padding: '5px 0',
              background: '#1D9E75', color: '#FFFFFF',
              border: 'none', borderRadius: 6,
              fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            ✓ 采纳替换
          </button>
          <button
            onClick={handleCopy}
            style={{
              padding: '5px 10px',
              background: 'transparent',
              color: copied ? '#1D9E75' : '#6B6B6B',
              border: '1px solid #E8E4DD', borderRadius: 6,
              fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            {copied ? '已复制' : '复制'}
          </button>
          <button
            onClick={() => { setDismissed(true); onDismiss() }}
            style={{
              padding: '5px 10px',
              background: 'transparent', color: '#B0ADA6',
              border: '1px solid #E8E4DD', borderRadius: 6,
              fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            不替换
          </button>
        </div>
      )}

      {adopted && (
        <div style={{ padding: '8px 12px', borderTop: '1px solid #F0EDE8', fontSize: 12, color: '#9FE1CB' }}>
          ✓ 已替换到编辑器
        </div>
      )}
    </div>
  )
}
