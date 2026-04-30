'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ReportNode } from '@/types'
import ReportNodeTree from './ReportNodeTree'

interface ReportTabContentProps {
  onOpenAiPanel?: (triggerMessage: string) => void
  onNodesChange?: (nodes: ReportNode[]) => void
}

export default function ReportTabContent({ onOpenAiPanel, onNodesChange }: ReportTabContentProps) {
  const [nodes, setNodes] = useState<ReportNode[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchNodes() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('report_nodes')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('sort_order')

      setNodes(data ?? [])
      setLoading(false)
    }
    fetchNodes()
  }, [])

  function handleNodeSaved(savedNode: ReportNode) {
    setNodes(prev => {
      const exists = prev.find(n => n.id === savedNode.id)
      const updated = exists
        ? prev.map(n => n.id === savedNode.id ? savedNode : n)
        : [...prev, savedNode]
      onNodesChange?.(updated)
      return updated
    })
  }

  function handleNodeDeleted(id: string) {
    setNodes(prev => {
      const updated = prev.filter(n => n.id !== id)
      onNodesChange?.(updated)
      return updated
    })
  }

  async function handleNodesReordered(reordered: ReportNode[]) {
    setNodes(reordered)
    onNodesChange?.(reordered)
    // Persist new sort_order for root nodes only
    const rootIds = reordered
      .filter(n => !n.parent_id)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(n => n.id)
    await fetch('/api/report-nodes/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: rootIds }),
    })
  }

  if (loading) {
    return (
      <div style={{ padding: 24, color: '#B0ADA6', fontSize: 13 }}>加载中...</div>
    )
  }

  return (
    <div style={{ padding: '4px 0' }}>
      <ReportNodeTree
        nodes={nodes}
        onNodeSaved={handleNodeSaved}
        onNodeDeleted={handleNodeDeleted}
        onNodesReordered={handleNodesReordered}
        onOpenAiPanel={onOpenAiPanel}
      />
    </div>
  )
}
