'use client'
import { useEffect, useState } from 'react'
import { ReportModule, ReportNode } from '@/types'

interface ReportNodeEditorProps {
  node: ReportNode | null
  allNodes: ReportNode[]
  onSaved: (node: ReportNode) => void
  onClose: () => void
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  border: '1px solid #E8E4DD',
  borderRadius: 7,
  padding: '6px 9px',
  fontSize: 13,
  color: '#1A1A1A',
  background: '#F8F7F4',
  outline: 'none',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  fontWeight: 500,
  color: '#B0ADA6',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  marginBottom: 5,
}

const STYLE_PLACEHOLDER = `描述你在这类汇报中的风格偏好，例如：
• 汇报重点：以结果和数据驱动，突出 ROI
• 对象关注点：老板更在意风险和资源，不关心技术细节
• 语气风格：简洁直接，结论前置，避免废话`

export default function ReportNodeEditor({ node, allNodes, onSaved, onClose }: ReportNodeEditorProps) {
  const [form, setForm] = useState({
    name: node?.name ?? '',
    audience: node?.audience ?? '',
    style: node?.style ?? '',
  })
  const [modules, setModules] = useState<ReportModule[]>(node?.modules ?? [])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  function addModule() {
    setModules(prev => [...prev, { id: Date.now().toString(), name: '', description: '' }])
  }

  function updateModule(id: string, field: 'name' | 'description', value: string) {
    setModules(prev => prev.map(m => m.id === id ? { ...m, [field]: value } : m))
  }

  function removeModule(id: string) {
    setModules(prev => prev.filter(m => m.id !== id))
  }

  async function handleSave() {
    if (!form.name.trim()) {
      setError('汇报名称不能为空')
      return
    }
    setSaving(true)
    setError('')

    const payload = {
      ...(node?.id ? { id: node.id } : {}),
      name: form.name.trim(),
      audience: form.audience || null,
      style: form.style || null,
      modules: modules.filter(m => m.name.trim()),
      sort_order: node?.sort_order ?? 99,
    }

    try {
      const res = await fetch('/api/report-nodes/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      onSaved(data.node)
    } catch (e) {
      setError((e as Error).message || '保存失败，请稍后重试')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        backdropFilter: 'blur(2px)',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        style={{
          width: 520,
          background: '#FFFFFF',
          borderRadius: 12,
          overflow: 'hidden',
          boxShadow: '0 8px 40px rgba(0,0,0,0.15)',
        }}
      >
        {/* 头部 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 22px',
            borderBottom: '1px solid #E8E4DD',
          }}
        >
          <span style={{ fontSize: 15, fontWeight: 500, color: '#1A1A1A' }}>
            {node ? '编辑汇报层级' : '新增汇报层级'}
          </span>
          <span
            style={{ fontSize: 20, color: '#B0ADA6', cursor: 'pointer', lineHeight: 1 }}
            onClick={onClose}
          >
            ×
          </span>
        </div>

        {/* 内容区 */}
        <div style={{ padding: '18px 22px', maxHeight: '70vh', overflowY: 'auto' }}>

          {/* 汇报名称 */}
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>汇报名称 *</label>
            <input
              style={inputStyle}
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="如「周报」「季度述职」"
            />
          </div>

          {/* 汇报对象 */}
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>汇报对象</label>
            <input
              style={inputStyle}
              value={form.audience}
              onChange={e => setForm(f => ({ ...f, audience: e.target.value }))}
              placeholder="如「直属总监」「财务总监」"
            />
          </div>

          {/* 汇报风格 */}
          <div style={{ marginBottom: 18 }}>
            <label style={labelStyle}>汇报风格</label>
            <textarea
              style={{
                ...inputStyle,
                minHeight: 90,
                resize: 'vertical',
                lineHeight: 1.6,
              }}
              value={form.style}
              onChange={e => setForm(f => ({ ...f, style: e.target.value }))}
              placeholder={STYLE_PLACEHOLDER}
            />
            <div style={{ marginTop: 5, fontSize: 11, color: '#B0ADA6', lineHeight: 1.5 }}>
              可以描述：汇报重点、对象最在意什么、偏好的语气风格（口语化/正式/数据驱动等）
            </div>
          </div>

          {/* 包含模块 */}
          <div style={{ marginBottom: 6 }}>
            <label style={labelStyle}>包含模块</label>
            {modules.map((m) => (
              <div
                key={m.id}
                style={{
                  border: '1px solid #E8E4DD',
                  borderRadius: 8,
                  padding: '10px 12px',
                  marginBottom: 8,
                  background: '#F8F7F4',
                  position: 'relative',
                }}
              >
                {/* 三级标题行 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <span style={{ fontSize: 12, color: '#B0ADA6', fontWeight: 600, flexShrink: 0 }}>
                    ###
                  </span>
                  <input
                    value={m.name}
                    onChange={e => updateModule(m.id, 'name', e.target.value)}
                    placeholder="模块标题，如「核心项目进展」"
                    style={{
                      ...inputStyle,
                      fontSize: 14,
                      fontWeight: 600,
                      background: 'transparent',
                      border: 'none',
                      borderBottom: '1px solid #E8E4DD',
                      borderRadius: 0,
                      padding: '2px 0',
                      flex: 1,
                    }}
                  />
                  <button
                    onClick={() => removeModule(m.id)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#B0ADA6',
                      fontSize: 16,
                      cursor: 'pointer',
                      padding: '0 2px',
                      flexShrink: 0,
                      lineHeight: 1,
                    }}
                  >
                    ×
                  </button>
                </div>
                {/* 描述行 */}
                <textarea
                  value={m.description}
                  onChange={e => updateModule(m.id, 'description', e.target.value)}
                  placeholder="描述这个模块应包含哪些内容，如「本周推进的主要项目，含里程碑和阻塞点」"
                  style={{
                    ...inputStyle,
                    background: 'transparent',
                    border: 'none',
                    padding: '2px 0 0 22px',
                    fontSize: 12,
                    color: '#6B6B6B',
                    minHeight: 48,
                    resize: 'none',
                    lineHeight: 1.6,
                  }}
                />
              </div>
            ))}
            <button
              onClick={addModule}
              style={{
                background: 'transparent',
                border: '1px dashed #E8E4DD',
                borderRadius: 6,
                padding: '5px 12px',
                fontSize: 12,
                color: '#6B6B6B',
                cursor: 'pointer',
                marginTop: 2,
              }}
            >
              + 添加模块
            </button>
          </div>
        </div>

        {/* 底部操作 */}
        <div
          style={{
            padding: '14px 22px',
            borderTop: '1px solid #E8E4DD',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ fontSize: 12, color: '#D94F4F' }}>{error}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={onClose}
              disabled={saving}
              style={{
                padding: '6px 14px',
                background: 'transparent',
                border: '1px solid #E8E4DD',
                borderRadius: 7,
                fontSize: 13,
                color: '#6B6B6B',
                cursor: saving ? 'not-allowed' : 'pointer',
              }}
            >
              取消
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                padding: '6px 14px',
                background: saving ? '#6B6B6B' : '#1D9E75',
                border: 'none',
                borderRadius: 7,
                fontSize: 13,
                fontWeight: 500,
                color: '#FFFFFF',
                cursor: saving ? 'not-allowed' : 'pointer',
              }}
            >
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
