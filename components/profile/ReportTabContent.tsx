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
        onOpenAiPanel={onOpenAiPanel}
      />
    </div>
  )
}
