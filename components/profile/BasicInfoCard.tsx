'use client'

import { useState } from 'react'
import { UserProfile } from '@/types'

interface BasicInfoCardProps {
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

const fields = [
  { key: 'job_title' as const, label: '职位', placeholder: '如：产品经理' },
  { key: 'industry' as const, label: '行业', placeholder: '如：互联网' },
  { key: 'work_years' as const, label: '工作年限', placeholder: '如：3', type: 'number' },
  { key: 'company_size' as const, label: '公司规模', placeholder: '如：500人以上' },
]

export default function BasicInfoCard({ profile, onUpdate }: BasicInfoCardProps) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    job_title: profile?.job_title ?? '',
    industry: profile?.industry ?? '',
    work_years: profile?.work_years?.toString() ?? '',
    company_size: profile?.company_size ?? '',
  })

  function handleEdit() {
    setForm({
      job_title: profile?.job_title ?? '',
      industry: profile?.industry ?? '',
      work_years: profile?.work_years?.toString() ?? '',
      company_size: profile?.company_size ?? '',
    })
    setEditing(true)
  }

  async function handleSave() {
    setSaving(true)
    const payload = {
      job_title: form.job_title || null,
      industry: form.industry || null,
      work_years: form.work_years ? parseInt(form.work_years) : null,
      company_size: form.company_size || null,
    }
    await fetch('/api/profile/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    onUpdate(payload)
    setSaving(false)
    setEditing(false)
  }

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <span style={sectionLabelStyle}>基本信息</span>
        {!editing && (
          <button style={editBtnStyle} onClick={handleEdit}>编辑</button>
        )}
      </div>

      {/* 展示态 */}
      {!editing && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 24px' }}>
          {fields.map(f => (
            <div key={f.key}>
              <div style={{ fontSize: 11, color: '#B0ADA6', marginBottom: 3 }}>{f.label}</div>
              <div style={{
                fontSize: 13,
                color: profile?.[f.key] ? '#1A1A1A' : '#B0ADA6',
                fontStyle: profile?.[f.key] ? 'normal' : 'italic',
              }}>
                {profile?.[f.key]?.toString() || '未填写'}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 编辑态 */}
      {editing && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px', marginBottom: 16 }}>
            {fields.map(f => (
              <div key={f.key}>
                <label style={{ fontSize: 12, color: '#6B6B6B', display: 'block', marginBottom: 4 }}>{f.label}</label>
                <input
                  type={f.type ?? 'text'}
                  value={form[f.key]}
                  onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  style={{
                    width: '100%', padding: '7px 10px', fontSize: 13,
                    border: '1px solid #E8E4DD', borderRadius: 7, outline: 'none',
                    fontFamily: 'inherit', boxSizing: 'border-box',
                  }}
                />
              </div>
            ))}
          </div>
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
