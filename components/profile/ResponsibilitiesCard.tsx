'use client'

import { useState } from 'react'
import { UserProfile } from '@/types'

interface ResponsibilitiesCardProps {
  profile: UserProfile | null
  onUpdate: (updated: Partial<UserProfile>) => void
}

const cardStyle: React.CSSProperties = {
  background: '#FFFFFF',
  border: '1px solid #E8E4DD',
  borderRadius: 10,
  padding: '18px 20px',
}

const sectionLabelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 500,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  color: '#B0ADA6',
}

const editBtnStyle: React.CSSProperties = {
  fontSize: 12,
  color: '#6B6B6B',
  border: '1px solid #E8E4DD',
  borderRadius: 6,
  padding: '3px 10px',
  background: 'transparent',
  cursor: 'pointer',
}

const saveBtnStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 500,
  color: '#FFFFFF',
  background: '#1D9E75',
  border: 'none',
  borderRadius: 6,
  padding: '4px 12px',
  cursor: 'pointer',
}

const cancelBtnStyle: React.CSSProperties = {
  fontSize: 12,
  color: '#6B6B6B',
  background: 'transparent',
  border: '1px solid #E8E4DD',
  borderRadius: 6,
  padding: '4px 12px',
  cursor: 'pointer',
}

export default function ResponsibilitiesCard({ profile, onUpdate }: ResponsibilitiesCardProps) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [value, setValue] = useState(profile?.job_responsibilities ?? '')

  function handleEdit() {
    setValue(profile?.job_responsibilities ?? '')
    setEditing(true)
  }

  async function handleSave() {
    setSaving(true)
    await fetch('/api/profile/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ job_responsibilities: value || null }),
    })
    onUpdate({ job_responsibilities: value || null })
    setSaving(false)
    setEditing(false)
  }

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <span style={sectionLabelStyle}>基本工作职责</span>
        {!editing && (
          <button style={editBtnStyle} onClick={handleEdit}>编辑</button>
        )}
      </div>

      {/* 展示态 */}
      {!editing && (
        profile?.job_responsibilities ? (
          <p style={{ fontSize: 13, color: '#1A1A1A', lineHeight: 1.7, margin: 0 }}>
            {profile.job_responsibilities}
          </p>
        ) : (
          <p style={{ fontSize: 13, color: '#B0ADA6', lineHeight: 1.7, margin: 0 }}>
            还没有填写工作职责。点击「编辑」手动填写，或通过 AI 助手帮你整理。
          </p>
        )
      )}

      {/* 编辑态 */}
      {editing && (
        <>
          <textarea
            value={value}
            onChange={e => setValue(e.target.value)}
            placeholder="描述你的日常工作职责，AI 可以帮你润色..."
            rows={5}
            style={{
              width: '100%', padding: '8px 10px', fontSize: 13,
              border: '1px solid #E8E4DD', borderRadius: 7, outline: 'none',
              fontFamily: 'inherit', lineHeight: 1.7, resize: 'vertical',
              marginBottom: 12, boxSizing: 'border-box',
            }}
          />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button style={cancelBtnStyle} onClick={() => setEditing(false)} disabled={saving}>取消</button>
            <button style={saveBtnStyle} onClick={handleSave} disabled={saving}>
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
