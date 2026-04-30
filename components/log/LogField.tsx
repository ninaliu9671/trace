'use client'

import { useState } from 'react'
import { Dimension, LogFieldState } from '@/types'

interface LogFieldProps {
  dimension: Dimension
  fieldState: LogFieldState
  locked: boolean
  isActive: boolean
  onFocus?: () => void
  onChange: (content: string, isAiFilled?: boolean) => void
}

function autoRows(value: string): number {
  const lines = value.split('\n').length
  return Math.max(4, lines + 1)
}

function getFieldStyle(
  fieldState: LogFieldState,
  locked: boolean,
  focused: boolean
): React.CSSProperties {
  const base: React.CSSProperties = {
    width: '100%',
    paddingTop: '9px',
    paddingRight: '12px',
    paddingBottom: '9px',
    paddingLeft: '12px',
    fontSize: 13,
    fontFamily: 'inherit',
    lineHeight: 1.7,
    borderTopLeftRadius: 7,
    borderTopRightRadius: 7,
    borderBottomRightRadius: 7,
    borderBottomLeftRadius: 7,
    outline: 'none',
    resize: 'none',
    transition: 'border-color 0.15s ease',
    minHeight: 72,
    borderTopWidth: '1px',
    borderTopStyle: 'solid',
    borderTopColor: '#E8E4DD',
    borderRightWidth: '1px',
    borderRightStyle: 'solid',
    borderRightColor: '#E8E4DD',
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderBottomColor: '#E8E4DD',
    borderLeftWidth: '1px',
    borderLeftStyle: 'solid',
    borderLeftColor: '#E8E4DD',
  }

  if (locked) return {
    ...base,
    background: '#F8F7F4',
    cursor: 'default',
    color: '#6B6B6B',
    borderTopColor: '#F0EDE8',
    borderRightColor: '#F0EDE8',
    borderBottomColor: '#F0EDE8',
    borderLeftColor: '#F0EDE8',
  }

  if (fieldState.isAiFilled && fieldState.content) return {
    ...base,
    background: '#F8FFFE',
    borderTopColor: '#C5EAE0',
    borderRightColor: '#C5EAE0',
    borderBottomColor: '#C5EAE0',
    borderLeftWidth: '2.5px',
    borderLeftColor: '#9FE1CB',
  }

  if (fieldState.content && !focused) return {
    ...base,
    background: '#FDFFFE',
    borderLeftWidth: '2.5px',
    borderLeftColor: '#1D9E75',
  }

  if (focused) return {
    ...base,
    background: '#FFFFFF',
    borderTopColor: '#1D9E75',
    borderRightColor: '#1D9E75',
    borderBottomColor: '#1D9E75',
    borderLeftColor: '#1D9E75',
    borderLeftWidth: '1px',
  }

  return {
    ...base,
    background: '#FFFFFF',
  }
}

export default function LogField({
  dimension,
  fieldState,
  locked,
  isActive,
  onFocus,
  onChange,
}: LogFieldProps) {
  const [focused, setFocused] = useState(false)

  return (
    <div
      id={`log-field-${dimension.id}`}
      style={{
        marginBottom: 20,
        scrollMarginTop: 16,
      }}
    >
      {dimension.prompt_text && (
        <div
          style={{
            fontSize: 11,
            color: isActive ? '#0F6E56' : '#B0ADA6',
            marginBottom: 5,
            lineHeight: 1.5,
            transition: 'color 0.15s ease',
          }}
        >
          {dimension.name}
          <span style={{ margin: '0 6px', color: '#E8E4DD' }}>·</span>
          {dimension.prompt_text}
        </div>
      )}

      <textarea
        value={fieldState.content}
        onChange={e => {
          if (locked) return
          onChange(e.target.value, false)
        }}
        onFocus={() => { setFocused(true); onFocus?.() }}
        onBlur={() => setFocused(false)}
        readOnly={locked}
        rows={autoRows(fieldState.content)}
        placeholder={locked ? '' : (dimension.prompt_text ?? `记录 ${dimension.name}...`)}
        style={getFieldStyle(fieldState, locked, focused)}
      />

      {fieldState.isAiFilled && fieldState.content && (
        <div style={{ fontSize: 11, color: '#9FE1CB', marginTop: 3 }}>
          ✦ 由 AI 助手填入
        </div>
      )}
    </div>
  )
}
