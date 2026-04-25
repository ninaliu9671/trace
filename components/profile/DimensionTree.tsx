'use client'

import { useState, useEffect } from 'react'
import { Dimension } from '@/types'
import { buildDimensionTree } from '@/lib/dimensionUtils'

interface DimensionNodeItemProps {
  node: Dimension
  number: string
  allDimensions: Dimension[]
  onEdit: (dim: Dimension) => void
  onDeleted: (ids: string[]) => void
}

function DimensionNodeItem({ node, number, allDimensions, onEdit, onDeleted }: DimensionNodeItemProps) {
  const [deleting, setDeleting] = useState(false)
  const isLeaf = node.level === 3

  async function handleDelete() {
    if (!confirm(`确认删除「${node.name}」及其所有子维度？`)) return
    setDeleting(true)
    try {
      const res = await fetch('/api/dimensions/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: node.id }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      onDeleted(data.deletedIds)
    } catch {
      alert('删除失败，请稍后重试')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div style={{ marginLeft: (node.level - 1) * 20, marginBottom: 4 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          padding: '8px 12px',
          borderRadius: 7,
          background: isLeaf ? '#F8FFFE' : 'transparent',
          border: isLeaf ? '1px solid #E8F7F2' : '1px solid transparent',
        }}
        onMouseEnter={e => {
          if (!isLeaf) (e.currentTarget as HTMLDivElement).style.background = '#FAFAF8'
        }}
        onMouseLeave={e => {
          if (!isLeaf) (e.currentTarget as HTMLDivElement).style.background = 'transparent'
        }}
      >
        {/* 序号 + 图标 + 名称 */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'flex-start', gap: 6 }}>
          <span style={{ fontSize: 12, color: '#B0ADA6', minWidth: 36, paddingTop: 1 }}>
            {number}
          </span>
          {node.level === 1 && (
            <span style={{ fontSize: 14, lineHeight: 1.4 }}>{node.icon}</span>
          )}
          <div>
            <span style={{
              fontSize: 13,
              fontWeight: node.level === 1 ? 500 : 400,
              color: '#1A1A1A',
            }}>
              {node.name}
            </span>
            {isLeaf && node.prompt_text && (
              <div style={{ fontSize: 12, color: '#6B6B6B', marginTop: 2, lineHeight: 1.6 }}>
                提示词：{node.prompt_text}
              </div>
            )}
          </div>
        </div>

        {/* 操作按钮 */}
        <div style={{ display: 'flex', gap: 6, flexShrink: 0, marginLeft: 8 }}>
          <button
            onClick={() => onEdit(node)}
            style={{
              fontSize: 11, color: '#6B6B6B',
              border: '1px solid #E8E4DD', borderRadius: 5,
              padding: '2px 8px', background: 'transparent', cursor: 'pointer',
            }}
          >
            编辑
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            style={{
              fontSize: 11,
              color: deleting ? '#B0ADA6' : '#D94F4F',
              border: '1px solid #F0EDE8', borderRadius: 5,
              padding: '2px 8px', background: 'transparent',
              cursor: deleting ? 'default' : 'pointer',
            }}
          >
            {deleting ? '...' : '删除'}
          </button>
        </div>
      </div>

      {/* 子节点递归 */}
      {node.children?.map((child, ci) => (
        <DimensionNodeItem
          key={child.id}
          node={child}
          number={`${number}.${ci + 1}`}
          allDimensions={allDimensions}
          onEdit={onEdit}
          onDeleted={onDeleted}
        />
      ))}
    </div>
  )
}

// ─── DimensionNodeEditor（新增/编辑弹窗）─────────────────────────────────
interface DimensionNodeEditorProps {
  node: Dimension | null
  allDimensions: Dimension[]
  onSaved: (dim: Dimension) => void
  onClose: () => void
}

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  color: '#6B6B6B',
  display: 'block',
  marginBottom: 4,
  fontWeight: 500,
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '7px 10px',
  fontSize: 13,
  border: '1px solid #E8E4DD',
  borderRadius: 7,
  outline: 'none',
  fontFamily: 'inherit',
  boxSizing: 'border-box' as const,
  background: '#FFFFFF',
}

function DimensionNodeEditor({ node, allDimensions, onSaved, onClose }: DimensionNodeEditorProps) {
  const [form, setForm] = useState({
    name: node?.name ?? '',
    icon: node?.icon ?? '📋',
    level: node?.level ?? (1 as 1 | 2 | 3),
    parent_id: node?.parent_id ?? '',
    prompt_text: node?.prompt_text ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  function handleLevelChange(newLevel: number) {
    setForm(prev => ({ ...prev, level: newLevel as 1 | 2 | 3, parent_id: '' }))
  }

  const parentOptions = allDimensions
    .filter(d => {
      if (form.level === 2) return d.level === 1
      if (form.level === 3) return d.level === 2
      return false
    })
    .filter(d => d.id !== node?.id)

  async function handleSave() {
    if (!form.name.trim()) { setError('维度名称不能为空'); return }
    if (form.level > 1 && !form.parent_id) { setError('请选择父节点'); return }

    setSaving(true)
    setError('')

    const payload = {
      ...(node?.id ? { id: node.id } : {}),
      name: form.name.trim(),
      icon: form.icon || '📋',
      level: form.level,
      parent_id: form.parent_id || null,
      prompt_text: form.level === 3 ? (form.prompt_text || null) : null,
      sort_order: node?.sort_order ?? 99,
    }

    try {
      const res = await fetch('/api/dimensions/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      onSaved(data.dimension)
    } catch (e) {
      setError((e as Error).message || '保存失败，请稍后重试')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        backgroundColor: 'rgba(0,0,0,0.3)',
        backdropFilter: 'blur(2px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        width: 440,
        background: '#FFFFFF',
        borderRadius: 12,
        border: '1px solid #E8E4DD',
        padding: '24px 28px',
        position: 'relative',
      }}>
        {/* 标题栏 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <span style={{ fontSize: 15, fontWeight: 500, color: '#1A1A1A' }}>
            {node ? '编辑维度' : '添加维度'}
          </span>
          <button
            onClick={onClose}
            style={{ fontSize: 18, color: '#B0ADA6', background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1 }}
          >
            ×
          </button>
        </div>

        {/* 维度名称 */}
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>维度名称 *</label>
          <input
            value={form.name}
            onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
            placeholder="如：需求分析"
            style={inputStyle}
            autoFocus
          />
        </div>

        {/* 图标 */}
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>图标 <span style={{ color: '#B0ADA6', fontWeight: 400 }}>（emoji）</span></label>
          <input
            value={form.icon}
            onChange={e => setForm(prev => ({ ...prev, icon: e.target.value }))}
            placeholder="📋"
            style={{ ...inputStyle, width: 80 }}
          />
        </div>

        {/* 层级 */}
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>层级 *</label>
          <select
            value={form.level}
            onChange={e => handleLevelChange(Number(e.target.value))}
            style={inputStyle}
            disabled={!!node}
          >
            <option value={1}>1 级（职能大类）</option>
            <option value={2}>2 级（工作模块）</option>
            <option value={3}>3 级（记录条目，含每日提示词）</option>
          </select>
          {node && (
            <div style={{ fontSize: 11, color: '#B0ADA6', marginTop: 4 }}>编辑时不可修改层级</div>
          )}
        </div>

        {/* 父节点（level > 1 时显示） */}
        {form.level > 1 && (
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>父节点 *</label>
            <select
              value={form.parent_id}
              onChange={e => setForm(prev => ({ ...prev, parent_id: e.target.value }))}
              style={inputStyle}
            >
              <option value="">— 选择父节点 —</option>
              {parentOptions.map(p => (
                <option key={p.id} value={p.id}>{p.icon} {p.name}</option>
              ))}
            </select>
            {parentOptions.length === 0 && (
              <div style={{ fontSize: 11, color: '#F59E0B', marginTop: 4 }}>
                请先添加 {form.level - 1} 级维度作为父节点
              </div>
            )}
          </div>
        )}

        {/* 提示词（level 3 时显示） */}
        {form.level === 3 && (
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>
              提示词
              <span style={{ color: '#B0ADA6', fontWeight: 400, marginLeft: 4 }}>
                （每日记录时显示在输入框上方）
              </span>
            </label>
            <textarea
              value={form.prompt_text}
              onChange={e => setForm(prev => ({ ...prev, prompt_text: e.target.value }))}
              placeholder="如：今天在需求侧做了什么？推进到哪了？"
              rows={2}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </div>
        )}

        {/* 错误提示 */}
        {error && (
          <div style={{ fontSize: 12, color: '#D94F4F', marginBottom: 12 }}>{error}</div>
        )}

        {/* 按钮组 */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              fontSize: 13, color: '#6B6B6B', background: 'transparent',
              border: '1px solid #E8E4DD', borderRadius: 7,
              padding: '7px 16px', cursor: 'pointer',
            }}
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              fontSize: 13, fontWeight: 500, color: '#FFFFFF',
              background: saving ? '#6B6B6B' : '#1D9E75',
              border: 'none', borderRadius: 7,
              padding: '7px 16px', cursor: saving ? 'default' : 'pointer',
            }}
          >
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── DimensionTree（主组件）──────────────────────────────────────────────
interface DimensionTreeProps {
  dimensions: Dimension[]
  onDimensionSaved: (dim: Dimension) => void
  onDimensionDeleted: (ids: string[]) => void
  onOpenAiPanel?: (triggerMessage: string) => void
}

export default function DimensionTree({ dimensions, onDimensionSaved, onDimensionDeleted, onOpenAiPanel }: DimensionTreeProps) {
  const [editingDim, setEditingDim] = useState<Dimension | null>(null)
  const [showEditor, setShowEditor] = useState(false)

  const tree = buildDimensionTree(dimensions)

  if (dimensions.length === 0) {
    return (
      <div style={{
        border: '1.5px dashed #E8E4DD',
        borderRadius: 10,
        padding: '40px 24px',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 24, marginBottom: 12 }}>◫</div>
        <div style={{ fontSize: 14, fontWeight: 500, color: '#6B6B6B', marginBottom: 6 }}>
          还没有设置记录维度
        </div>
        <div style={{ fontSize: 13, color: '#B0ADA6', marginBottom: 20, lineHeight: 1.7 }}>
          汇报框架设置完成后，AI 会自动倒推出你每天应该记录的维度
        </div>
        <button
          onClick={() => onOpenAiPanel?.('请帮我设计记录维度。请根据我的汇报框架，倒推出我每天应该记录哪些维度的内容。')}
          style={{
            background: '#E8F7F2', color: '#0F6E56',
            border: '1px solid #9FE1CB', borderRadius: 7,
            padding: '7px 16px', fontSize: 13, cursor: 'pointer',
          }}
        >
          ✦ 让 AI 帮我设计
        </button>
      </div>
    )
  }

  return (
    <>
      {/* 关联说明横幅 */}
      <div style={{
        padding: '8px 12px',
        background: '#F0FBF7',
        border: '1px solid #E8F7F2',
        borderRadius: 7,
        fontSize: 12,
        color: '#0F6E56',
        marginBottom: 16,
      }}>
        ↑ 以上维度由汇报框架倒推而来。AI 生成汇报总结时会按这些维度归类日志。
      </div>

      {/* 树形节点 */}
      {tree.map((root, i) => (
        <DimensionNodeItem
          key={root.id}
          node={root}
          number={`${i + 1}`}
          allDimensions={dimensions}
          onEdit={(dim) => { setEditingDim(dim); setShowEditor(true) }}
          onDeleted={onDimensionDeleted}
        />
      ))}

      {/* 底部添加按钮 */}
      <button
        onClick={() => { setEditingDim(null); setShowEditor(true) }}
        style={{
          marginTop: 12, width: '100%', padding: '9px',
          border: '1.5px dashed #E8E4DD', borderRadius: 8,
          background: 'transparent', color: '#6B6B6B',
          fontSize: 13, cursor: 'pointer',
        }}
      >
        + 添加职能维度
      </button>

      {showEditor && (
        <DimensionNodeEditor
          node={editingDim}
          allDimensions={dimensions}
          onSaved={(saved) => { onDimensionSaved(saved); setShowEditor(false) }}
          onClose={() => setShowEditor(false)}
        />
      )}
    </>
  )
}
