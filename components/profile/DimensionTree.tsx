'use client'

import { createContext, useContext, useRef, useState, useEffect } from 'react'
import { Dimension } from '@/types'
import { buildDimensionTree } from '@/lib/dimensionUtils'

// ─── Drag context ────────────────────────────────────────────────────────────

interface DragCtxValue {
  draggingId: string | null
  overId: string | null
  dropZone: 'before' | 'inside' | null
  allDimensions: Dimension[]
  setDragging: (id: string | null) => void
  setOver: (id: string | null, zone: 'before' | 'inside' | null) => void
  commitDrop: (overId: string, zone: 'before' | 'inside') => void
}

const DragCtx = createContext<DragCtxValue>({
  draggingId: null, overId: null, dropZone: null, allDimensions: [],
  setDragging: () => {}, setOver: () => {}, commitDrop: () => {},
})

// ─── DimensionNodeItem ────────────────────────────────────────────────────────

interface DimensionNodeItemProps {
  node: Dimension
  number: string
  onEdit: (dim: Dimension) => void
  onDeleted: (ids: string[]) => void
}

function DimensionNodeItem({ node, number, onEdit, onDeleted }: DimensionNodeItemProps) {
  const { draggingId, overId, dropZone, setDragging, setOver, commitDrop } = useContext(DragCtx)
  const [deleting, setDeleting] = useState(false)
  const [hovered, setHovered] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)

  const isDragging = draggingId === node.id
  const isOver = overId === node.id
  const isLeaf = !node.children || node.children.length === 0

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

  function handleDragStart(e: React.DragEvent) {
    e.stopPropagation()
    e.dataTransfer.effectAllowed = 'move'
    setDragging(node.id)
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!cardRef.current || draggingId === node.id) return
    const rect = cardRef.current.getBoundingClientRect()
    const zone: 'before' | 'inside' = (e.clientY - rect.top) < rect.height * 0.35 ? 'before' : 'inside'
    setOver(node.id, zone)
  }

  function handleDragLeave(e: React.DragEvent) {
    if (!cardRef.current?.contains(e.relatedTarget as Node)) {
      if (overId === node.id) setOver(null, null)
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (dropZone && overId === node.id) commitDrop(node.id, dropZone)
  }

  const indent = (node.level - 1) * 20

  return (
    <div style={{ marginLeft: indent, opacity: isDragging ? 0.35 : 1, transition: 'opacity 0.12s' }}>
      {/* "before" drop indicator */}
      {isOver && dropZone === 'before' && (
        <div style={{
          height: 3, borderRadius: 2, background: '#1D9E75',
          marginBottom: 3, marginLeft: -indent,
        }} />
      )}

      {/* Card row */}
      <div
        ref={cardRef}
        draggable
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          padding: '8px 12px',
          borderRadius: 7,
          marginBottom: 4,
          background: isLeaf ? '#F8FFFE' : (hovered ? '#FAFAF8' : 'transparent'),
          border: isOver && dropZone === 'inside'
            ? '1px solid #1D9E75'
            : isLeaf ? '1px solid #E8F7F2' : '1px solid transparent',
          cursor: 'grab',
          transition: 'border-color 0.12s, background 0.1s',
          userSelect: 'none',
        }}
      >
        {/* Drag handle */}
        <span style={{
          fontSize: 13, color: hovered ? '#B0ADA6' : 'transparent',
          cursor: 'grab', lineHeight: 1, marginTop: 2, marginRight: 6,
          flexShrink: 0, transition: 'color 0.15s',
        }}>
          ⠿
        </span>

        {/* Number + icon + name */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'flex-start', gap: 6 }}>
          <span style={{ fontSize: 12, color: '#B0ADA6', minWidth: 36, paddingTop: 1 }}>
            {number}
          </span>
          {node.level === 1 && (
            <span style={{ fontSize: 14, lineHeight: 1.4 }}>{node.icon}</span>
          )}
          <div>
            <span style={{ fontSize: 13, fontWeight: node.level === 1 ? 500 : 400, color: '#1A1A1A' }}>
              {node.name}
            </span>
            {isOver && dropZone === 'inside' && (
              <span style={{ fontSize: 10, color: '#1D9E75', marginLeft: 8, fontWeight: 500 }}>
                放入此处
              </span>
            )}
            {isLeaf && node.prompt_text && (
              <div style={{ fontSize: 12, color: '#6B6B6B', marginTop: 2, lineHeight: 1.6 }}>
                提示词：{node.prompt_text}
              </div>
            )}
          </div>
        </div>

        {/* Action buttons */}
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
              fontSize: 11, color: deleting ? '#B0ADA6' : '#D94F4F',
              border: '1px solid #F0EDE8', borderRadius: 5,
              padding: '2px 8px', background: 'transparent',
              cursor: deleting ? 'default' : 'pointer',
            }}
          >
            {deleting ? '...' : '删除'}
          </button>
        </div>
      </div>

      {/* Children */}
      {node.children?.map((child, ci) => (
        <DimensionNodeItem
          key={child.id}
          node={child}
          number={`${number}.${ci + 1}`}
          onEdit={onEdit}
          onDeleted={onDeleted}
        />
      ))}
    </div>
  )
}

// ─── DimensionNodeEditor ──────────────────────────────────────────────────────

interface DimensionNodeEditorProps {
  node: Dimension | null
  allDimensions: Dimension[]
  onSaved: (dim: Dimension) => void
  onClose: () => void
}

const labelStyle: React.CSSProperties = {
  fontSize: 12, color: '#6B6B6B', display: 'block', marginBottom: 4, fontWeight: 500,
}
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '7px 10px', fontSize: 13,
  border: '1px solid #E8E4DD', borderRadius: 7, outline: 'none',
  fontFamily: 'inherit', boxSizing: 'border-box' as const, background: '#FFFFFF',
}

function DimensionNodeEditor({ node, allDimensions, onSaved, onClose }: DimensionNodeEditorProps) {
  const initialGrandparentId = (() => {
    if (node && node.level >= 3 && node.parent_id) {
      const parent = allDimensions.find(d => d.id === node.parent_id)
      return parent?.parent_id ?? ''
    }
    return ''
  })()

  const [form, setForm] = useState({
    name: node?.name ?? '',
    icon: node?.icon ?? '📋',
    level: node?.level ?? 1,
    parent_id: node?.parent_id ?? '',
    prompt_text: node?.prompt_text ?? '',
  })
  const [grandparentId, setGrandparentId] = useState(initialGrandparentId)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    function handleKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  function handleLevelChange(newLevel: number) {
    setForm(prev => ({ ...prev, level: newLevel, parent_id: '' }))
    setGrandparentId('')
  }

  function handleGrandparentChange(id: string) {
    setGrandparentId(id)
    setForm(prev => ({ ...prev, parent_id: '' }))
  }

  const level1Options = allDimensions.filter(d => d.level === 1 && d.id !== node?.id)
  const level2Options = allDimensions.filter(d => d.level === 2 && d.parent_id === grandparentId && d.id !== node?.id)
  const parentOptions = form.level === 2 ? level1Options : level2Options

  async function handleSave() {
    if (!form.name.trim()) { setError('维度名称不能为空'); return }
    if (form.level > 1 && !form.parent_id) { setError('请选择母节点'); return }
    setSaving(true)
    setError('')
    const payload = {
      ...(node?.id ? { id: node.id } : {}),
      name: form.name.trim(),
      icon: form.icon || '📋',
      level: form.level,
      parent_id: form.parent_id || null,
      prompt_text: form.level >= 3 ? (form.prompt_text || null) : null,
      sort_order: node?.sort_order ?? 99,
    }
    try {
      const res = await fetch('/api/dimensions/save', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
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
        backgroundColor: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(2px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        width: 440, background: '#FFFFFF', borderRadius: 12,
        border: '1px solid #E8E4DD', padding: '24px 28px', position: 'relative',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <span style={{ fontSize: 15, fontWeight: 500, color: '#1A1A1A' }}>
            {node ? '编辑维度' : '添加维度'}
          </span>
          <button onClick={onClose} style={{ fontSize: 18, color: '#B0ADA6', background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>维度名称 *</label>
          <input
            value={form.name}
            onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
            placeholder="如：需求分析" style={inputStyle} autoFocus
          />
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>图标 <span style={{ color: '#B0ADA6', fontWeight: 400 }}>（emoji）</span></label>
          <input
            value={form.icon}
            onChange={e => setForm(prev => ({ ...prev, icon: e.target.value }))}
            placeholder="📋" style={{ ...inputStyle, width: 80 }}
          />
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>层级 *</label>
          <select value={form.level} onChange={e => handleLevelChange(Number(e.target.value))} style={inputStyle} disabled={!!node}>
            <option value={1}>1 级（职能大类）</option>
            <option value={2}>2 级（工作模块）</option>
            <option value={3}>3 级（记录条目，含每日提示词）</option>
          </select>
          {node && <div style={{ fontSize: 11, color: '#B0ADA6', marginTop: 4 }}>编辑时不可修改层级</div>}
        </div>

        {form.level === 2 && (
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>母节点 *</label>
            <select value={form.parent_id} onChange={e => setForm(prev => ({ ...prev, parent_id: e.target.value }))} style={inputStyle}>
              <option value="">— 选择母节点 —</option>
              {level1Options.map(p => <option key={p.id} value={p.id}>{p.icon} {p.name}</option>)}
            </select>
            {level1Options.length === 0 && (
              <div style={{ fontSize: 11, color: '#F59E0B', marginTop: 4 }}>请先添加 1 级维度作为母节点</div>
            )}
          </div>
        )}

        {form.level === 3 && (
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>母节点 *</label>
            <select value={grandparentId} onChange={e => handleGrandparentChange(e.target.value)} style={inputStyle}>
              <option value="">— 选择一级节点 —</option>
              {level1Options.map(p => <option key={p.id} value={p.id}>{p.icon} {p.name}</option>)}
            </select>
            {grandparentId && (
              <select value={form.parent_id} onChange={e => setForm(prev => ({ ...prev, parent_id: e.target.value }))} style={{ ...inputStyle, marginTop: 6 }}>
                <option value="">— 选择二级节点 —</option>
                {level2Options.map(p => <option key={p.id} value={p.id}>{p.icon} {p.name}</option>)}
              </select>
            )}
            {grandparentId && level2Options.length === 0 && (
              <div style={{ fontSize: 11, color: '#F59E0B', marginTop: 4 }}>该一级节点下暂无二级维度，请先添加</div>
            )}
          </div>
        )}

        {form.level >= 3 && (
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>
              提示词 <span style={{ color: '#B0ADA6', fontWeight: 400, marginLeft: 4 }}>（每日记录时显示在输入框上方）</span>
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

        {error && <div style={{ fontSize: 12, color: '#D94F4F', marginBottom: 12 }}>{error}</div>}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ fontSize: 13, color: '#6B6B6B', background: 'transparent', border: '1px solid #E8E4DD', borderRadius: 7, padding: '7px 16px', cursor: 'pointer' }}>
            取消
          </button>
          <button onClick={handleSave} disabled={saving} style={{ fontSize: 13, fontWeight: 500, color: '#FFFFFF', background: saving ? '#6B6B6B' : '#1D9E75', border: 'none', borderRadius: 7, padding: '7px 16px', cursor: saving ? 'default' : 'pointer' }}>
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── DimensionTree（主组件）──────────────────────────────────────────────────

interface DimensionTreeProps {
  dimensions: Dimension[]
  onDimensionSaved: (dim: Dimension) => void
  onDimensionDeleted: (ids: string[]) => void
  onDimensionMoved: () => void
  onOpenAiPanel?: (triggerMessage: string) => void
}

export default function DimensionTree({
  dimensions, onDimensionSaved, onDimensionDeleted, onDimensionMoved, onOpenAiPanel,
}: DimensionTreeProps) {
  const [editingDim, setEditingDim] = useState<Dimension | null>(null)
  const [showEditor, setShowEditor] = useState(false)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)
  const [dropZone, setDropZone] = useState<'before' | 'inside' | null>(null)

  const tree = buildDimensionTree(dimensions)

  function setDragging(id: string | null) {
    setDraggingId(id)
    if (!id) { setOverId(null); setDropZone(null) }
  }

  function setOver(id: string | null, zone: 'before' | 'inside' | null) {
    setOverId(id)
    setDropZone(zone)
  }

  async function commitDrop(targetId: string, zone: 'before' | 'inside') {
    if (!draggingId || draggingId === targetId) {
      setDragging(null)
      return
    }

    const targetNode = dimensions.find(d => d.id === targetId)
    if (!targetNode) { setDragging(null); return }

    const newParentId = zone === 'inside' ? targetId : targetNode.parent_id
    const insertBeforeId = zone === 'before' ? targetId : null

    setDragging(null)

    try {
      const res = await fetch('/api/dimensions/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: draggingId, newParentId, insertBeforeId }),
      })
      const data = await res.json()
      if (data.error) {
        alert(data.error)
        return
      }
      onDimensionMoved()
    } catch {
      alert('移动失败，请稍后重试')
    }
  }

  const ctxValue: DragCtxValue = {
    draggingId, overId, dropZone, allDimensions: dimensions,
    setDragging, setOver, commitDrop,
  }

  if (dimensions.length === 0) {
    return (
      <div style={{ border: '1.5px dashed #E8E4DD', borderRadius: 10, padding: '40px 24px', textAlign: 'center' }}>
        <div style={{ fontSize: 24, marginBottom: 12 }}>◫</div>
        <div style={{ fontSize: 14, fontWeight: 500, color: '#6B6B6B', marginBottom: 6 }}>还没有设置记录维度</div>
        <div style={{ fontSize: 13, color: '#B0ADA6', marginBottom: 20, lineHeight: 1.7 }}>
          汇报框架设置完成后，AI 会自动倒推出你每天应该记录的维度
        </div>
        <button
          onClick={() => onOpenAiPanel?.('请帮我设计记录维度。请根据我的汇报框架，倒推出我每天应该记录哪些维度的内容。')}
          style={{ background: '#E8F7F2', color: '#0F6E56', border: '1px solid #9FE1CB', borderRadius: 7, padding: '7px 16px', fontSize: 13, cursor: 'pointer' }}
        >
          ✦ 让 AI 帮我设计
        </button>
      </div>
    )
  }

  return (
    <DragCtx.Provider value={ctxValue}>
      <div
        onDragEnd={() => setDragging(null)}
        onDragOver={e => e.preventDefault()}
      >
        {/* 关联说明横幅 */}
        <div style={{
          padding: '8px 12px', background: '#F0FBF7', border: '1px solid #E8F7F2',
          borderRadius: 7, fontSize: 12, color: '#0F6E56', marginBottom: 16,
        }}>
          ↑ 以上维度由汇报框架倒推而来。AI 生成汇报总结时会按这些维度归类日志。
        </div>

        {tree.map((root, i) => (
          <DimensionNodeItem
            key={root.id}
            node={root}
            number={`${i + 1}`}
            onEdit={(dim) => { setEditingDim(dim); setShowEditor(true) }}
            onDeleted={onDimensionDeleted}
          />
        ))}

        <button
          onClick={() => { setEditingDim(null); setShowEditor(true) }}
          style={{
            marginTop: 12, width: '100%', padding: '9px',
            border: '1.5px dashed #E8E4DD', borderRadius: 8,
            background: 'transparent', color: '#6B6B6B', fontSize: 13, cursor: 'pointer',
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
      </div>
    </DragCtx.Provider>
  )
}
