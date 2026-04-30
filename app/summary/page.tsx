'use client'
import { useState, useEffect } from 'react'
import Sidebar from '@/components/layout/Sidebar'
import AiSidePanel from '@/components/AiSidePanel'
import SummaryList from '@/components/summary/SummaryList'
import NewSummaryModal from '@/components/summary/NewSummaryModal'
import DataCompletenessAlert from '@/components/summary/DataCompletenessAlert'
import SummaryGeneratingOverlay from '@/components/summary/SummaryGeneratingOverlay'
import MarkdownEditor from '@/components/summary/MarkdownEditor'
import SummaryTopbar from '@/components/summary/SummaryTopbar'
import { Summary, CompletenessResult, NewSummaryParams } from '@/types'
import { isCompletenessResult } from '@/lib/summary-result'

export default function SummaryPage() {
  const [summaries, setSummaries] = useState<Summary[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [aiOpen, setAiOpen] = useState(false)

  // 新建总结流程状态
  const [showNewModal, setShowNewModal] = useState(false)
  const [pendingParams, setPendingParams] = useState<NewSummaryParams | null>(null)
  const [completenessResult, setCompletenessResult] = useState<CompletenessResult | null>(null)
  const [checkingCompleteness, setCheckingCompleteness] = useState(false)
  const [generating, setGenerating] = useState(false)

  // 编辑器状态
  const [editorContent, setEditorContent] = useState('')
  const [initialContent, setInitialContent] = useState('')
  const [editorMode, setEditorMode] = useState<'edit' | 'preview'>('preview')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function fetchSummaries() {
      setLoading(true)
      try {
        const res = await fetch('/api/summary/list')
        const data = await res.json()
        if (!res.ok || data?.error) {
          throw new Error(data?.error || '加载失败，请稍后重试')
        }
        setSummaries(data.summaries ?? [])
      } catch (err) {
        console.error('Load summaries failed:', err)
        setSummaries([])
      } finally {
        setLoading(false)
      }
    }
    fetchSummaries()
  }, [])

  const selectedSummary = summaries.find(s => s.id === selectedId) ?? null

  function handleSelectSummary(id: string) {
    const nextSummary = summaries.find(s => s.id === id)
    setSelectedId(id)
    if (!nextSummary) return
    setEditorContent(nextSummary.content)
    setInitialContent(nextSummary.content)
    setEditorMode(nextSummary.is_draft ? 'edit' : 'preview')
  }

  async function handleModeChange(mode: 'edit' | 'preview') {
    if (mode === 'preview' && selectedSummary?.is_draft && editorContent !== initialContent) {
      setSaving(true)
      try {
        await fetch(`/api/summary/${selectedSummary.id}/update`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: editorContent }),
        })
        setInitialContent(editorContent)
        setSummaries(prev =>
          prev.map(s => s.id === selectedSummary.id ? { ...s, content: editorContent } : s)
        )
      } catch {
        // 保存失败不阻止切换
      } finally {
        setSaving(false)
      }
    }
    setEditorMode(mode)
  }

  function handleRevert() {
    setEditorContent(initialContent)
  }

  async function handleFinalize() {
    if (!selectedSummary) return
    const updateRes = await fetch(`/api/summary/${selectedSummary.id}/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: editorContent }),
    })
    if (!updateRes.ok) {
      const data = await updateRes.json().catch(() => ({}))
      throw new Error((data as { error?: string }).error || '保存内容失败，请稍后重试')
    }
    const finalizeRes = await fetch(`/api/summary/${selectedSummary.id}/finalize`, { method: 'POST' })
    if (!finalizeRes.ok) {
      const data = await finalizeRes.json().catch(() => ({}))
      throw new Error((data as { error?: string }).error || '定稿失败，请稍后重试')
    }
    setSummaries(prev =>
      prev.map(s =>
        s.id === selectedSummary.id
          ? { ...s, is_draft: false, content: editorContent, finalized_at: new Date().toISOString() }
          : s
      )
    )
    setInitialContent(editorContent)
    setEditorMode('preview')
  }

  async function handleReEdit() {
    if (!selectedSummary) return
    const res = await fetch(`/api/summary/${selectedSummary.id}/re-edit`, { method: 'POST' })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error((data as { error?: string }).error || '操作失败，请稍后重试')
    }
    setSummaries(prev =>
      prev.map(s =>
        s.id === selectedSummary.id
          ? { ...s, is_draft: true, finalized_at: null }
          : s
      )
    )
    setEditorMode('edit')
  }

  function handleReplaceSuggestionAdopt(original: string, replacement: string): boolean {
    const idx = editorContent.indexOf(original)
    if (idx === -1) return false
    setEditorContent(prev => prev.slice(0, idx) + replacement + prev.slice(idx + original.length))
    if (editorMode === 'preview') setEditorMode('edit')
    return true
  }

  const aiExtraParams = selectedSummary
    ? { currentContent: editorContent }
    : { currentContent: '' }

  async function handleModalSubmit(params: NewSummaryParams) {
    setShowNewModal(false)
    setCheckingCompleteness(true)
    setPendingParams(params)
    try {
      const res = await fetch('/api/summary/check-completeness', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dateFrom: params.dateFrom,
          dateTo: params.dateTo,
          summaryType: params.summaryType,
        }),
      })
      const data: unknown = await res.json()
      setCheckingCompleteness(false)
      if (!res.ok || !isCompletenessResult(data)) {
        alert((data as { error?: string })?.error ?? '检查数据失败，请稍后重试')
        setPendingParams(null)
        return
      }
      if (data.completeness === 'complete') {
        handleStartGenerate(params, data)
      } else {
        setCompletenessResult(data)
      }
    } catch {
      setCheckingCompleteness(false)
      handleStartGenerate(params, null)
    }
  }

  async function handleStartGenerate(params: NewSummaryParams, completenessData: CompletenessResult | null) {
    setCompletenessResult(null)
    setPendingParams(null)
    setGenerating(true)
    try {
      const res = await fetch('/api/summary/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dateFrom: params.dateFrom,
          dateTo: params.dateTo,
          summaryType: params.summaryType,
          dimensionIds: params.dimensionIds,
          reportNodeId: params.reportNodeId,
          completeness: completenessData?.completeness ?? 'logs_only',
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) { alert(data.error ?? '生成失败，请稍后重试'); return }
      if (!data.summary) { alert('生成失败：未返回总结内容'); return }
      const newSummary: Summary = data.summary
      setSummaries(prev => [newSummary, ...prev])
      setSelectedId(newSummary.id)
      setEditorContent(newSummary.content)
      setInitialContent(newSummary.content)
      setEditorMode(newSummary.is_draft ? 'edit' : 'preview')
    } catch {
      alert('生成失败，请稍后重试')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#F8F7F4', overflow: 'hidden' }}>
      <Sidebar />

      <div style={{
        flex: 1, display: 'flex', overflow: 'hidden',
        marginRight: aiOpen ? 280 : 0,
        transition: 'margin-right 0.2s ease',
      }}>
        {/* 左侧总结列表 */}
        <div style={{
          width: 220, flexShrink: 0,
          borderRight: '1px solid #F0EDE8',
          background: '#FAFAF8',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 14px 10px',
            borderBottom: '1px solid #F0EDE8', flexShrink: 0,
          }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: '#1A1A1A' }}>工作总结</span>
            <button
              onClick={() => setShowNewModal(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 3,
                padding: '4px 8px', background: '#1D9E75', color: '#FFFFFF',
                border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer',
              }}
            >
              + 新建
            </button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loading ? (
              <div style={{ padding: '16px 14px', fontSize: 12, color: '#B0ADA6' }}>加载中...</div>
            ) : (
              <SummaryList summaries={summaries} selectedId={selectedId} onSelect={handleSelectSummary} />
            )}
          </div>
        </div>

        {/* 右侧内容区 */}
        {selectedSummary ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <SummaryTopbar
              summary={selectedSummary}
              content={editorContent}
              initialContent={initialContent}
              mode={editorMode}
              saving={saving}
              onModeChange={handleModeChange}
              onRevert={handleRevert}
              onFinalize={handleFinalize}
              onReEdit={handleReEdit}
              aiOpen={aiOpen}
              onAiToggle={() => setAiOpen(prev => !prev)}
            />
            <div style={{ flex: 1, overflowY: 'auto' }}>
              <MarkdownEditor
                content={editorContent}
                onChange={setEditorContent}
                mode={editorMode}
                locked={!selectedSummary.is_draft}
                onSwitchToEdit={() => setEditorMode('edit')}
              />
            </div>
          </div>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{
              height: 56, display: 'flex', alignItems: 'center',
              justifyContent: 'space-between', padding: '0 24px',
              borderBottom: '1px solid #F0EDE8', flexShrink: 0,
            }}>
              <span style={{ fontSize: 15, fontWeight: 500, color: '#1A1A1A' }}>汇报总结</span>
              <button
                onClick={() => setAiOpen(prev => !prev)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '6px 12px',
                  background: aiOpen ? '#1D9E75' : '#E8F7F2',
                  color: aiOpen ? '#FFFFFF' : '#0F6E56',
                  border: `1px solid ${aiOpen ? '#1D9E75' : '#9FE1CB'}`,
                  borderRadius: 7, fontSize: 12, fontWeight: 500,
                  cursor: 'pointer', transition: 'all 0.15s ease',
                }}
              >
                ✦ AI 助手
              </button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              <EmptyState />
            </div>
          </div>
        )}
      </div>

      <AiSidePanel
        key={selectedId ?? 'no-selection'}
        isOpen={aiOpen}
        onClose={() => setAiOpen(false)}
        contextLabel={
          selectedSummary
            ? `已读取：${selectedSummary.title ?? formatSummaryTitle(selectedSummary)}（编辑器当前内容）`
            : '请先选择一份总结'
        }
        apiRoute="/api/summary/ai-chat"
        extraBodyParams={aiExtraParams}
        onReplaceSuggestionAdopt={handleReplaceSuggestionAdopt}
      />

      {showNewModal && (
        <NewSummaryModal onClose={() => setShowNewModal(false)} onSubmit={handleModalSubmit} />
      )}

      {checkingCompleteness && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 45,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.1)',
        }}>
          <div style={{
            background: '#FFFFFF', borderRadius: 10, padding: '16px 24px',
            fontSize: 13, color: '#6B6B6B', border: '1px solid #E8E4DD',
            boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
          }}>
            检查数据中...
          </div>
        </div>
      )}

      {completenessResult && pendingParams && (
        <DataCompletenessAlert
          result={completenessResult}
          onProceed={() => handleStartGenerate(pendingParams, completenessResult)}
          onCancel={() => { setCompletenessResult(null); setPendingParams(null) }}
        />
      )}

      {generating && <SummaryGeneratingOverlay />}
    </div>
  )
}

function EmptyState() {
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: 12, height: '100%', color: '#B0ADA6',
    }}>
      <span style={{ fontSize: 32 }}>◫</span>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 13, marginBottom: 4 }}>点击左侧列表查看总结</div>
        <div style={{ fontSize: 12 }}>或点击「+ 新建」创建新的工作总结</div>
      </div>
    </div>
  )
}

function formatSummaryTitle(summary: Summary): string {
  const typeLabels: Record<Summary['summary_type'], string> = {
    weekly: '周报', monthly: '月报', quarterly: '季报',
    annual: '年报/述职', adhoc: '临时汇报',
  }
  const label = typeLabels[summary.summary_type] ?? '总结'
  const from = summary.date_from.slice(0, 7).replace('-', '年') + '月'
  return `${from}${label}`
}
