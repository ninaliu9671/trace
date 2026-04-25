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

const granularityOptions = [
  { value: '', label: '— 不设定 —' },
  { value: 'daily', label: '每日' },
  { value: 'weekly', label: '每周' },
  { value: 'monthly', label: '每月' },
  { value: 'quarterly', label: '每季度' },
  { value: 'annual', label: '每年' },
]

export default function ReportNodeEditor({ node, allNodes, onSaved, onClose }: ReportNodeEditorProps) {
  const [form, setForm] = useState({
    name: node?.name ?? '',
    trigger_desc: node?.trigger_desc ?? '',
    audience: node?.audience ?? '',
    time_granularity: node?.time_granularity ?? '',
    parent_id: node?.parent_id ?? '',
  })
  const [modules, setModules] = useState<ReportModule[]>(node?.modules ?? [])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const parentOptions = allNodes.filter(n => n.id !== node?.id)

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
      trigger_desc: form.trigger_desc || null,
      audience: form.audience || null,
      time_granularity: form.time_granularity || null,
      parent_id: form.parent_id || null,
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
          width: 480,
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

          {/* 触发方式 */}
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>触发方式</label>
            <input
              style={inputStyle}
              value={form.trigger_desc}
              onChange={e => setForm(f => ({ ...f, trigger_desc: e.target.value }))}
              placeholder="如「每周五」"
            />
          </div>

          {/* 汇报对象 */}
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>汇报对象</label>
            <input
              style={inputStyle}
              value={form.audience}
              onChange={e => setForm(f => ({ ...f, audience: e.target.value }))}
              placeholder="如「直属总监」"
            />
          </div>

          {/* 汇报周期 */}
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>汇报周期</label>
            <select
              style={{ ...inputStyle, cursor: 'pointer' }}
              value={form.time_granularity}
              onChange={e => setForm(f => ({ ...f, time_granularity: e.target.value }))}
            >
              {granularityOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* 依赖上层节点 */}
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>依赖上层节点</label>
            <select
              style={{ ...inputStyle, cursor: 'pointer' }}
              value={form.parent_id}
              onChange={e => setForm(f => ({ ...f, parent_id: e.target.value }))}
            >
              <option value="">— 顶层节点 —</option>
              {parentOptions.map(n => (
                <option key={n.id} value={n.id}>{n.name}</option>
              ))}
            </select>
          </div>

          {/* 包含模块 */}
          <div style={{ marginBottom: 6 }}>
            <label style={labelStyle}>包含模块</label>
            {modules.map(m => (
              <div key={m.id} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                <input
                  value={m.name}
                  onChange={e => updateModule(m.id, 'name', e.target.value)}
                  placeholder="模块名称"
                  style={{ ...inputStyle, width: 130, flexShrink: 0 }}
                />
                <input
                  value={m.description}
                  onChange={e => updateModule(m.id, 'description', e.target.value)}
                  placeholder="简要描述"
                  style={{ ...inputStyle, flex: 1 }}
                />
                <button
                  onClick={() => removeModule(m.id)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#B0ADA6',
                    fontSize: 16,
                    cursor: 'pointer',
                    padding: '0 4px',
                    flexShrink: 0,
                  }}
                >
                  ×
                </button>
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
