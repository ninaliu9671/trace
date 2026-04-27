'use client'
import { useState } from 'react'
import { ReportNode } from '@/types'
import ReportNodeEditor from './ReportNodeEditor'

function buildTree(nodes: ReportNode[]): ReportNode[] {
  const map: Record<string, ReportNode> = {}
  const roots: ReportNode[] = []

  for (const node of nodes) {
    map[node.id] = { ...node, children: [] }
  }

  for (const node of Object.values(map)) {
    if (node.parent_id && map[node.parent_id]) {
      map[node.parent_id].children!.push(node)
    } else {
      roots.push(node)
    }
  }

  function sortChildren(n: ReportNode) {
    n.children?.sort((a, b) => a.sort_order - b.sort_order)
    n.children?.forEach(sortChildren)
  }
  roots.sort((a, b) => a.sort_order - b.sort_order)
  roots.forEach(sortChildren)

  return roots
}

interface ReportNodeItemProps {
  node: ReportNode
  depth: number
  allNodes: ReportNode[]
  onEdit: (node: ReportNode) => void
  onDelete: (node: ReportNode) => void
}

function ReportNodeItem({ node, depth, allNodes, onEdit, onDelete }: ReportNodeItemProps) {
  const isLeaf = !node.children || node.children.length === 0

  return (
    <div style={{ position: 'relative' }}>
      {depth > 0 && (
        <div
          style={{
            position: 'absolute',
            left: depth * 20 - 12,
            top: 0,
            bottom: 0,
            width: 1.5,
            background: '#E8E4DD',
          }}
        />
      )}

      <div
        style={{
          marginLeft: depth * 20,
          marginBottom: 8,
          padding: '12px 14px',
          background: isLeaf ? '#F0FBF7' : '#FAFAF8',
          border: `1px solid ${isLeaf ? '#9FE1CB' : '#E8E4DD'}`,
          borderRadius: 8,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: isLeaf ? '#0F6E56' : '#1A1A1A' }}>
              {node.name}
            </span>
            {node.trigger_desc && (
              <span style={{ fontSize: 12, color: '#B0ADA6', marginLeft: 8 }}>
                {node.trigger_desc}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 6, flexShrink: 0, marginLeft: 8 }}>
            <button
              onClick={() => onEdit(node)}
              style={{
                fontSize: 11,
                color: '#6B6B6B',
                border: '1px solid #E8E4DD',
                borderRadius: 5,
                padding: '2px 8px',
                background: 'transparent',
                cursor: 'pointer',
              }}
            >
              编辑
            </button>
            <button
              onClick={() => {
                if (window.confirm(`确认删除「${node.name}」？`)) {
                  onDelete(node)
                }
              }}
              style={{
                fontSize: 11,
                color: '#D94F4F',
                border: '1px solid #F5C6C6',
                borderRadius: 5,
                padding: '2px 8px',
                background: 'transparent',
                cursor: 'pointer',
              }}
            >
              删除
            </button>
          </div>
        </div>

        {node.audience && (
          <div style={{ fontSize: 12, color: '#6B6B6B', marginTop: 4 }}>
            汇报对象：{node.audience}
          </div>
        )}

        {node.modules.length > 0 && (
          <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {node.modules.map(m => (
              <span
                key={m.id}
                title={m.description}
                style={{
                  fontSize: 11,
                  color: '#6B6B6B',
                  background: '#F4F3F0',
                  border: '1px solid #E8E4DD',
                  borderRadius: 4,
                  padding: '1px 6px',
                }}
              >
                {m.name}
              </span>
            ))}
          </div>
        )}
      </div>

      {node.children?.map(child => (
        <ReportNodeItem
          key={child.id}
          node={child}
          depth={depth + 1}
          allNodes={allNodes}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  )
}

interface ReportNodeTreeProps {
  nodes: ReportNode[]
  onNodeSaved: (node: ReportNode) => void
  onNodeDeleted: (id: string) => void
  onOpenAiPanel?: (triggerMessage: string) => void
}

export default function ReportNodeTree({ nodes, onNodeSaved, onNodeDeleted, onOpenAiPanel }: ReportNodeTreeProps) {
  const [editingNode, setEditingNode] = useState<ReportNode | null>(null)
  const [showEditor, setShowEditor] = useState(false)

  const tree = buildTree(nodes)

  function handleEdit(node: ReportNode) {
    setEditingNode(node)
    setShowEditor(true)
  }

  function handleAddNew() {
    setEditingNode(null)
    setShowEditor(true)
  }

  async function handleDelete(node: ReportNode) {
    const res = await fetch('/api/report-nodes/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: node.id }),
    })
    const data = await res.json()
    if (!data.error) {
      onNodeDeleted(node.id)
    }
  }

  if (nodes.length === 0) {
    return (
      <>
        <div
          style={{
            border: '1.5px dashed #E8E4DD',
            borderRadius: 10,
            padding: '40px 24px',
            textAlign: 'center',
            color: '#B0ADA6',
          }}
        >
          <div style={{ fontSize: 24, marginBottom: 12 }}>⚙</div>
          <div style={{ fontSize: 14, fontWeight: 500, color: '#6B6B6B', marginBottom: 6 }}>
            还没有设置汇报框架
          </div>
          <div style={{ fontSize: 13, color: '#B0ADA6', marginBottom: 20, lineHeight: 1.7 }}>
            先完成职业画像，AI 会帮你从年报倒推设计完整的汇报体系
          </div>
          <button
            onClick={() => onOpenAiPanel?.('请帮我设计汇报框架。请先了解我的职业画像，再根据我的工作场景给出合适的汇报层级结构。')}
            style={{
              background: '#E8F7F2',
              color: '#0F6E56',
              border: '1px solid #9FE1CB',
              borderRadius: 7,
              padding: '7px 16px',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            ✦ 让 AI 帮我设计
          </button>
        </div>

        {showEditor && (
          <ReportNodeEditor
            node={null}
            allNodes={nodes}
            onSaved={(saved) => {
              onNodeSaved(saved)
              setShowEditor(false)
            }}
            onClose={() => setShowEditor(false)}
          />
        )}
      </>
    )
  }

  return (
    <>
      {tree.map(root => (
        <ReportNodeItem
          key={root.id}
          node={root}
          depth={0}
          allNodes={nodes}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      ))}

      <div
        style={{
          marginTop: 16,
          padding: '10px 14px',
          background: '#FAFAF8',
          borderRadius: 7,
          fontSize: 12,
          color: '#B0ADA6',
          border: '1px solid #F0EDE8',
        }}
      >
        生成汇报总结时，系统优先调用时间段内已有的定稿报告，其次使用原始日志。
      </div>

      <button
        onClick={handleAddNew}
        style={{
          marginTop: 12,
          width: '100%',
          padding: '9px',
          border: '1.5px dashed #E8E4DD',
          borderRadius: 8,
          background: 'transparent',
          color: '#6B6B6B',
          fontSize: 13,
          cursor: 'pointer',
        }}
      >
        + 添加汇报层级
      </button>

      {showEditor && (
        <ReportNodeEditor
          node={editingNode}
          allNodes={nodes}
          onSaved={(saved) => {
            onNodeSaved(saved)
            setShowEditor(false)
          }}
          onClose={() => setShowEditor(false)}
        />
      )}
    </>
  )
}
