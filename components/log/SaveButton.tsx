'use client'
import { useState } from 'react'

interface SaveButtonProps {
  onSave: () => Promise<void>
  disabled?: boolean
}

type SaveState = 'idle' | 'saving' | 'saved'

export default function SaveButton({ onSave, disabled }: SaveButtonProps) {
  const [state, setState] = useState<SaveState>('idle')

  async function handleClick() {
    if (state !== 'idle' || disabled) return
    setState('saving')
    try {
      await onSave()
      setState('saved')
    } catch {
      setState('idle')
    }
  }

  const configs: Record<SaveState, { label: string; bg: string; cursor: string }> = {
    idle:   { label: '💾 保存今日记录', bg: '#1A1A1A', cursor: 'pointer' },
    saving: { label: '保存中...',       bg: '#6B6B6B', cursor: 'default' },
    saved:  { label: '✓ 已保存',        bg: '#1D9E75', cursor: 'default' },
  }

  const cfg = configs[state]

  return (
    <div
      style={{
        position: 'sticky',
        bottom: 0,
        padding: '12px 24px',
        background: 'linear-gradient(to top, #F8F7F4 80%, transparent)',
      }}
    >
      <button
        onClick={handleClick}
        disabled={state !== 'idle' || disabled}
        style={{
          width: '100%',
          height: 44,
          background: disabled && state === 'idle' ? '#D3D1C7' : cfg.bg,
          color: '#FFFFFF',
          border: 'none',
          borderRadius: 8,
          fontSize: 14,
          fontWeight: 500,
          cursor: disabled && state === 'idle' ? 'not-allowed' : cfg.cursor,
          transition: 'background 0.2s ease',
          fontFamily: 'inherit',
        }}
      >
        {cfg.label}
      </button>
    </div>
  )
}
