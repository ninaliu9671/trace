'use client'

import { useEffect, useMemo, useState } from 'react'
import Sidebar from '@/components/layout/Sidebar'
import AiSidePanel from '@/components/AiSidePanel'
import DateNav from '@/components/log/DateNav'
import DimensionDirectory from '@/components/log/DimensionDirectory'
import LogContent from '@/components/log/LogContent'
import SaveButton from '@/components/log/SaveButton'
import SavedBanner from '@/components/log/SavedBanner'
import { createClient } from '@/lib/supabase/client'
import { toDateString } from '@/lib/utils'
import { DailyLog, Dimension, LogFieldState, LogPreviewItem } from '@/types'

export default function LogPage() {
  const [currentDate, setCurrentDate] = useState<Date>(new Date())
  const [aiOpen, setAiOpen] = useState(false)
  const [dimensions, setDimensions] = useState<Dimension[]>([])
  const [fieldStates, setFieldStates] = useState<Record<string, LogFieldState>>({})
  const [locked, setLocked] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [activeLevel2Id, setActiveLevel2Id] = useState<string | null>(null)
  const [dataLoading, setDataLoading] = useState(true)

  useEffect(() => {
    async function fetchDimensions() {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        setDimensions([])
        return
      }

      const { data } = await supabase
        .from('dimensions')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('sort_order')

      setDimensions(data ?? [])
    }

    fetchDimensions()
  }, [])

  useEffect(() => {
    let canceled = false

    async function fetchLogs() {
      setDataLoading(true)
      setFieldStates({})
      setLocked(false)
      setSavedAt(null)

      try {
        const dateStr = toDateString(currentDate)
        const res = await fetch(`/api/log/${dateStr}`)
        const data = await res.json()
        const logs: DailyLog[] = data.logs ?? []

        if (canceled) return

        if (logs.length > 0) {
          const states: Record<string, LogFieldState> = {}
          for (const log of logs) {
            states[log.dimension_id] = {
              content: log.content,
              isAiFilled: log.is_ai_generated,
            }
          }
          setFieldStates(states)
          setLocked(true)
          setSavedAt(logs[0].updated_at ?? logs[0].created_at ?? null)
        }
      } catch {
        if (canceled) return
        setFieldStates({})
        setLocked(false)
        setSavedAt(null)
      } finally {
        if (!canceled) {
          setDataLoading(false)
        }
      }
    }

    fetchLogs()

    return () => {
      canceled = true
    }
  }, [currentDate])


  useEffect(() => {
    if (activeLevel2Id && dimensions.some(d => d.id === activeLevel2Id && d.level === 2)) {
      return
    }
    const firstLevel2 = dimensions.find(d => d.level === 2)
    setActiveLevel2Id(firstLevel2?.id ?? null)
  }, [dimensions, activeLevel2Id])

  function handleFieldChange(dimensionId: string, content: string, isAiFilled = false) {
    setFieldStates(prev => ({
      ...prev,
      [dimensionId]: { content, isAiFilled },
    }))
  }

  async function handleSave() {
    try {
      const entries = Object.entries(fieldStates).map(([dimension_id, state]) => ({
        dimension_id,
        content: state.content,
        is_ai_generated: state.isAiFilled,
      }))
      const res = await fetch('/api/log/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: toDateString(currentDate), entries }),
      })
      const data = await res.json()
      if (data.error) {
        alert(`保存失败：${data.error}`)
        throw new Error(data.error)
      }
      setLocked(true)
      setSavedAt(data.savedAt)
    } catch (err) {
      console.error('Save failed:', err)
      throw err
    }
  }

  function handleLogPreviewAdopt(items: LogPreviewItem[]) {
    console.log('Adopting log preview items:', items)
    console.log('Current dimensions:', dimensions.map(d => ({ id: d.id, name: d.name })))
    setLocked(false)
    setFieldStates(prev => {
      const next = { ...prev }
      for (const item of items) {
        console.log(`Setting field for dimension_id: ${item.dimension_id}`)
        next[item.dimension_id] = { content: item.content, isAiFilled: true }
      }
      console.log('New fieldStates:', next)
      return next
    })
  }

  const existingLogsText = useMemo(() => {
    const parts = Object.entries(fieldStates)
      .filter(([, state]) => state.content.trim())
      .map(([id, state]) => {
        const dimension = dimensions.find(d => d.id === id)
        return `${dimension?.name ?? id}: ${state.content}`
      })

    return parts.length > 0 ? parts.join('\n') : '今天暂无记录'
  }, [fieldStates, dimensions])

  const dimensionsTreeText = useMemo(() => {
    if (dimensions.length === 0) return '暂无维度数据'
    return [...dimensions]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(d => `${'  '.repeat(d.level - 1)}[ID:${d.id}] ${d.name}${d.prompt_text ? `（${d.prompt_text}）` : ''}`)
      .join('\n')
  }, [dimensions])

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#F8F7F4', overflow: 'hidden' }}>
      <Sidebar />

      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          marginRight: aiOpen ? 280 : 0,
          transition: 'margin-right 0.2s ease',
        }}
      >
        <div
          style={{
            height: 56,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 24px',
            borderBottomWidth: '1px',
            borderBottomStyle: 'solid',
            borderBottomColor: '#F0EDE8',
            flexShrink: 0,
            background: '#F8F7F4',
          }}
        >
          <span style={{ fontSize: 16, fontWeight: 500, color: '#1A1A1A' }}>工作日志</span>

          <DateNav currentDate={currentDate} onDateChange={setCurrentDate} recordDates={[]} />

          <button
            onClick={() => setAiOpen(prev => !prev)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              background: aiOpen ? '#1D9E75' : '#E8F7F2',
              color: aiOpen ? '#FFFFFF' : '#0F6E56',
              border: `1px solid ${aiOpen ? '#1D9E75' : '#9FE1CB'}`,
              borderRadius: 7,
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            ✦ AI 助手
          </button>
        </div>

        {locked && savedAt && (
          <SavedBanner savedAt={savedAt} onEdit={() => setLocked(false)} />
        )}

        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          <div
            style={{
              width: 162,
              flexShrink: 0,
              borderRightWidth: '1px',
              borderRightStyle: 'solid',
              borderRightColor: '#F0EDE8',
              background: '#FAFAF8',
              padding: '16px 0',
              overflowY: 'auto',
            }}
          >
            {dataLoading ? (
              <div style={{ padding: '0 12px', fontSize: 12, color: '#B0ADA6' }}>维度目录加载中...</div>
            ) : (
              <DimensionDirectory
                dimensions={dimensions}
                fieldStates={fieldStates}
                activeLevel2Id={activeLevel2Id}
                onLevel2Click={setActiveLevel2Id}
              />
            )}
          </div>

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {dataLoading ? (
              <div style={{ padding: 24, fontSize: 13, color: '#B0ADA6' }}>日志内容加载中...</div>
            ) : (
              <>
                <LogContent
                  dimensions={dimensions}
                  fieldStates={fieldStates}
                  locked={locked}
                  activeLevel2Id={activeLevel2Id}
                  onLeafFocus={setActiveLevel2Id}
                  onFieldChange={handleFieldChange}
                />
                {!locked && (
                  <SaveButton
                    onSave={handleSave}
                    disabled={Object.values(fieldStates).every(s => !s.content.trim())}
                  />
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <AiSidePanel
        isOpen={aiOpen}
        onClose={() => setAiOpen(false)}
        contextLabel="已读取：今日工作记录"
        apiRoute="/api/log/ai-chat"
        logDimensionsTree={dimensionsTreeText}
        logExistingLogs={existingLogsText}
        initialMessage="你好！请告诉我今天做了什么，我来帮你整理到对应的记录维度里。"
        onLogPreviewAdopt={handleLogPreviewAdopt}
      />
    </div>
  )
}
