'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Dimension } from '@/types'
import DimensionTree from './DimensionTree'

interface DimensionTabContentProps {
  onOpenAiPanel?: (triggerMessage: string) => void
  onDimsChange?: (dims: Dimension[]) => void
}

export default function DimensionTabContent({ onOpenAiPanel, onDimsChange }: DimensionTabContentProps) {
  const [dimensions, setDimensions] = useState<Dimension[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchDimensions() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('dimensions')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('sort_order')

      setDimensions(data ?? [])
      setLoading(false)
    }
    fetchDimensions()
  }, [])

  function handleDimensionSaved(saved: Dimension) {
    setDimensions(prev => {
      const exists = prev.find(d => d.id === saved.id)
      const updated = exists
        ? prev.map(d => d.id === saved.id ? saved : d)
        : [...prev, saved]
      onDimsChange?.(updated)
      return updated
    })
  }

  function handleDimensionDeleted(deletedIds: string[]) {
    setDimensions(prev => {
      const updated = prev.filter(d => !deletedIds.includes(d.id))
      onDimsChange?.(updated)
      return updated
    })
  }

  if (loading) return (
    <div style={{ padding: 24, color: '#B0ADA6', fontSize: 13 }}>加载中...</div>
  )

  return (
    <div style={{ padding: 24 }}>
      <DimensionTree
        dimensions={dimensions}
        onDimensionSaved={handleDimensionSaved}
        onDimensionDeleted={handleDimensionDeleted}
        onOpenAiPanel={onOpenAiPanel}
      />
    </div>
  )
}
