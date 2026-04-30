'use client'
import { useState } from 'react'
import { Summary } from '@/types'
import RevertConfirm from './RevertConfirm'

interface SummaryTopbarProps {
  summary: Summary
  content: string
  initialContent: string
  mode: 'edit' | 'preview'
  isReEditing: boolean
  onModeChange: (mode: 'edit' | 'preview') => void
  onRevert: () => void
  onFinalize: () => void
  onReEdit: () => void
  aiOpen: boolean
  onAiToggle: () => void
}

const TYPE_LABELS: Record<string, string> = {
  weekly: '周报', monthly: '月报', quarterly: '季报',
  annual: '年报/述职', adhoc: '临时汇报',
}

export default function SummaryTopbar({
  summary, content, initialContent, mode, isReEditing,
  onModeChange, onRevert, onFinalize, onReEdit, aiOpen, onAiToggle,
}: SummaryTopbarProps) {
  const [showRevert, setShowRevert] = useState(false)
  const [finalizing, setFinalizing] = useState(false)

  const hasUnsavedChanges = content !== initialContent
  // 定稿：DB 已定稿 且 用户未点击"重新编辑"
  const isFinalized = !summary.is_draft && !isReEditing

  async function handleFinalize() {
    setFinalizing(true)
    try {
      await onFinalize()
    } catch (err) {
      alert(err instanceof Error ? err.message : '定稿失败，请稍后重试')
    } finally {
      setFinalizing(false)
    }
  }


  return (
    <>
      <div style={{
        height: 56,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        borderBottom: '1px solid #F0EDE8',
        flexShrink: 0,
        background: '#F8F7F4',
        gap: 12,
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
          <span style={{
            fontSize: 15, fontWeight: 500, color: '#1A1A1A',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {summary.title ?? `${formatShortMonth(summary.date_from)}${TYPE_LABELS[summary.summary_type] ?? '总结'}`}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
            <MetaTag label={TYPE_LABELS[summary.summary_type] ?? '总结'} />
            <MetaTag label={`${summary.date_from} 至 ${summary.date_to}`} />
            {isFinalized ? (
              <span style={{
                fontSize: 10, padding: '1px 5px', borderRadius: 3,
                background: '#F0FBF7', color: '#0F6E56',
                border: '1px solid #9FE1CB',
              }}>定稿</span>
            ) : (
              <span style={{
                fontSize: 10, padding: '1px 5px', borderRadius: 3,
                background: '#FFFBEB', color: '#92400E',
                border: '1px solid #FDE68A',
              }}>草稿</span>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {!isFinalized && hasUnsavedChanges && (
            <button
              onClick={() => setShowRevert(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '5px 10px',
                border: '1px solid #E8E4DD', borderRadius: 7,
                background: 'transparent', color: '#6B6B6B',
                fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              ↩ 恢复上版
            </button>
          )}

          <div style={{ display: 'flex', border: '1px solid #E8E4DD', borderRadius: 7, overflow: 'hidden' }}>
            {!isFinalized && (
              <ModeBtn label="编辑" active={mode === 'edit'} onClick={() => onModeChange('edit')} />
            )}
            <ModeBtn
              label="预览"
              active={mode === 'preview'}
              onClick={() => onModeChange('preview')}
              borderLeft={!isFinalized}
            />
          </div>

          <button
            onClick={onAiToggle}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '5px 10px',
              background: aiOpen ? '#1D9E75' : '#E8F7F2',
              color: aiOpen ? '#FFFFFF' : '#0F6E56',
              border: `1px solid ${aiOpen ? '#1D9E75' : '#9FE1CB'}`,
              borderRadius: 7, fontSize: 12, fontWeight: 500,
              cursor: 'pointer', transition: 'all 0.15s ease',
              fontFamily: 'inherit',
            }}
          >
            ✦ AI 助手
          </button>

          {!isFinalized ? (
            <button
              onClick={handleFinalize}
              disabled={finalizing}
              style={{
                padding: '5px 12px',
                border: 'none', borderRadius: 7,
                background: finalizing ? '#6B6B6B' : '#1A1A1A',
                color: '#FFFFFF', fontSize: 12, fontWeight: 500,
                cursor: finalizing ? 'default' : 'pointer',
                fontFamily: 'inherit',
                transition: 'background 0.15s ease',
              }}
            >
              {finalizing ? '定稿中...' : '存为定稿'}
            </button>
          ) : (
            <button
              onClick={onReEdit}
              style={{
                padding: '5px 12px',
                border: '1px solid #E8E4DD', borderRadius: 7,
                background: 'transparent',
                color: '#6B6B6B',
                fontSize: 12, cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              重新编辑
            </button>
          )}
        </div>
      </div>

      {showRevert && (
        <RevertConfirm
          onConfirm={() => { setShowRevert(false); onRevert() }}
          onCancel={() => setShowRevert(false)}
        />
      )}
    </>
  )
}

function ModeBtn({ label, active, onClick, borderLeft }: {
  label: string; active: boolean; onClick: () => void; borderLeft?: boolean
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '5px 12px',
        background: active ? '#1A1A1A' : 'transparent',
        color: active ? '#FFFFFF' : '#6B6B6B',
        border: 'none',
        borderLeft: borderLeft ? '1px solid #E8E4DD' : 'none',
        fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
      }}
    >
      {label}
    </button>
  )
}

function MetaTag({ label }: { label: string }) {
  return (
    <span style={{
      fontSize: 11, color: '#6B6B6B',
      background: '#F4F3F0', border: '1px solid #E8E4DD',
      borderRadius: 4, padding: '1px 6px',
    }}>
      {label}
    </span>
  )
}

function formatShortMonth(dateStr: string): string {
  const [y, m] = dateStr.split('-')
  return `${y}年${parseInt(m)}月`
}
