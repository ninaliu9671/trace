'use client'

import { useState } from 'react'
import { UserProfile } from '@/types'

interface CareerDirectionCardProps {
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

export default function CareerDirectionCard({ profile, onUpdate }: CareerDirectionCardProps) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [direction, setDirection] = useState(profile?.career_direction ?? '')
  const [skillFocus, setSkillFocus] = useState(profile?.skill_focus ?? '')

  function handleEdit() {
    setDirection(profile?.career_direction ?? '')
    setSkillFocus(profile?.skill_focus ?? '')
    setEditing(true)
  }

  async function handleSave() {
    setSaving(true)
    const payload = {
      career_direction: direction || null,
      skill_focus: skillFocus || null,
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

  const skills = (profile?.skill_focus ?? '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)

  const isEmpty = !profile?.career_direction && !profile?.skill_focus

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span style={sectionLabelStyle}>职业方向</span>
          <span style={{ fontSize: 11, color: '#B0ADA6' }}>选填</span>
        </div>
        {!editing && (
          <button style={editBtnStyle} onClick={handleEdit}>编辑</button>
        )}
      </div>

      {/* 展示态 */}
      {!editing && (
        isEmpty ? (
          <p style={{ fontSize: 13, color: '#B0ADA6', fontStyle: 'italic', margin: 0 }}>
            还没有填写职业方向。
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {profile?.career_direction && (
              <div>
                <div style={{ fontSize: 11, color: '#B0ADA6', marginBottom: 4 }}>目标</div>
                <p style={{ fontSize: 13, color: '#1A1A1A', lineHeight: 1.7, margin: 0 }}>
                  {profile.career_direction}
                </p>
              </div>
            )}
            {skills.length > 0 && (
              <div>
                <div style={{ fontSize: 11, color: '#B0ADA6', marginBottom: 6 }}>技能重点</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {skills.map((skill, i) => (
                    <span key={i} style={{
                      fontSize: 12, color: '#1A1A1A',
                      background: '#F4F3F0', border: '1px solid #E8E4DD',
                      borderRadius: 5, padding: '2px 8px',
                    }}>
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      )}

      {/* 编辑态 */}
      {editing && (
        <>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, color: '#6B6B6B', display: 'block', marginBottom: 4 }}>
              目标描述
              <span style={{ color: '#B0ADA6', fontWeight: 400, marginLeft: 4 }}>
                （可以写短期 1–2 年、中期 3–5 年、长期 7 年以上）
              </span>
            </label>
            <textarea
              value={direction}
              onChange={e => setDirection(e.target.value)}
              placeholder="写下你的职业目标..."
              rows={3}
              style={{
                width: '100%', padding: '8px 10px', fontSize: 13,
                border: '1px solid #E8E4DD', borderRadius: 7, outline: 'none',
                fontFamily: 'inherit', lineHeight: 1.7, resize: 'vertical',
                boxSizing: 'border-box',
              }}
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, color: '#6B6B6B', display: 'block', marginBottom: 4 }}>
              技能重点
              <span style={{ color: '#B0ADA6', fontWeight: 400, marginLeft: 4 }}>（逗号分隔）</span>
            </label>
            <input
              value={skillFocus}
              onChange={e => setSkillFocus(e.target.value)}
              placeholder="如：数据分析, 产品设计, 跨部门协作"
              style={{
                width: '100%', padding: '7px 10px', fontSize: 13,
                border: '1px solid #E8E4DD', borderRadius: 7, outline: 'none',
                fontFamily: 'inherit', boxSizing: 'border-box',
              }}
            />
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
