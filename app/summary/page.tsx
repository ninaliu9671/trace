'use client'
import { useState, useEffect } from 'react'
import Sidebar from '@/components/layout/Sidebar'
import AiSidePanel from '@/components/AiSidePanel'
import SummaryList from '@/components/summary/SummaryList'
import NewSummaryModal from '@/components/summary/NewSummaryModal'
import DataCompletenessAlert from '@/components/summary/DataCompletenessAlert'
import SummaryGeneratingOverlay from '@/components/summary/SummaryGeneratingOverlay'
import { Summary, CompletenessResult, NewSummaryParams } from '@/types'

const TYPE_LABELS: Record<string, string> = {
  weekly: '周报', monthly: '月报', quarterly: '季报',
  annual: '年报/述职', adhoc: '临时汇报',
}

function MetaTag({ label }: { label: string }) {
  return (
    <span style={{
      fontSize: 11, color: '#6B6B6B',
      background: '#F4F3F0',
      border: '1px solid #E8E4DD',
      borderRadius: 4,
      padding: '1px 6px',
    }}>
      {label}
    </span>
  )
}

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

  useEffect(() => {
    async function fetchSummaries() {
      setLoading(true)
      const res = await fetch('/api/summary/list')
      const data = await res.json()
      setSummaries(data.summaries ?? [])
      setLoading(false)
    }
    fetchSummaries()
  }, [])

  const selectedSummary = summaries.find(s => s.id === selectedId) ?? null

  function handleNewClick() {
    setShowNewModal(true)
  }

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
      const data: CompletenessResult = await res.json()
      setCheckingCompleteness(false)

      if (data.completeness === 'complete') {
        handleStartGenerate(params, data)
      } else {
        setCompletenessResult(data)
      }
    } catch {
      setCheckingCompleteness(false)
      if (params) handleStartGenerate(params, null)
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

      if (data.error) {
        alert(data.error)
        return
      }

      const newSummary: Summary = data.summary
      setSummaries(prev => [newSummary, ...prev])
      setSelectedId(newSummary.id)
    } catch {
      alert('生成失败，请稍后重试')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#F8F7F4', overflow: 'hidden' }}>
      {/* 左侧导航栏 */}
      <Sidebar />

      {/* 主内容区 */}
      <div style={{
        flex: 1,
        display: 'flex',
        overflow: 'hidden',
        marginRight: aiOpen ? 280 : 0,
        transition: 'margin-right 0.2s ease',
      }}>
        {/* 左侧总结列表（220px） */}
        <div style={{
          width: 220,
          flexShrink: 0,
          borderRight: '1px solid #F0EDE8',
          background: '#FAFAF8',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 14px 10px',
            borderBottom: '1px solid #F0EDE8',
            flexShrink: 0,
          }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: '#1A1A1A' }}>工作总结</span>
            <button
              onClick={handleNewClick}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 3,
                padding: '4px 8px',
                background: '#1D9E75',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              + 新建
            </button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loading ? (
              <div style={{ padding: '16px 14px', fontSize: 12, color: '#B0ADA6' }}>
                加载中...
              </div>
            ) : (
              <SummaryList
                summaries={summaries}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />
            )}
          </div>
        </div>

        {/* 右侧内容区 */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* 顶部栏 */}
          <div style={{
            height: 56,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 24px',
            borderBottom: '1px solid #F0EDE8',
            flexShrink: 0,
            background: '#F8F7F4',
          }}>
            {selectedSummary ? (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <span style={{ fontSize: 15, fontWeight: 500, color: '#1A1A1A' }}>
                    {selectedSummary.title ?? formatSummaryTitle(selectedSummary)}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <MetaTag label={TYPE_LABELS[selectedSummary.summary_type] ?? '总结'} />
                    <MetaTag label={`${selectedSummary.date_from} 至 ${selectedSummary.date_to}`} />
                    {selectedSummary.is_draft && (
                      <span style={{
                        fontSize: 10, padding: '1px 5px', borderRadius: 3,
                        background: '#FFFBEB', color: '#92400E',
                        border: '1px solid #FDE68A',
                      }}>草稿</span>
                    )}
                  </div>
                </div>
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
              </>
            ) : (
              <>
                <span style={{ fontSize: 15, fontWeight: 500, color: '#1A1A1A' }}>汇报总结</span>
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
              </>
            )}
          </div>

          {/* 内容主区域 */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {selectedSummary ? (
              <div style={{ padding: '24px', flex: 1 }}>
                {/* Task 16 替换为 MarkdownEditor */}
                <pre style={{
                  fontSize: 13,
                  color: '#1A1A1A',
                  lineHeight: 1.8,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  fontFamily: 'JetBrains Mono, monospace',
                  margin: 0,
                }}>
                  {selectedSummary.content}
                </pre>
              </div>
            ) : (
              <EmptyState />
            )}
          </div>
        </div>
      </div>

      {/* AI 面板 */}
      <AiSidePanel
        isOpen={aiOpen}
        onClose={() => setAiOpen(false)}
        contextLabel={
          selectedSummary
            ? `已读取：${selectedSummary.title ?? formatSummaryTitle(selectedSummary)}`
            : '请先选择一份总结'
        }
        apiRoute="/api/summary/ai-chat"
      />

      {/* 新建总结弹窗 */}
      {showNewModal && (
        <NewSummaryModal
          onClose={() => setShowNewModal(false)}
          onSubmit={handleModalSubmit}
        />
      )}

      {/* 完整度检查中的简单 loading 提示 */}
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

      {/* 完整度提示弹窗 */}
      {completenessResult && pendingParams && (
        <DataCompletenessAlert
          result={completenessResult}
          onProceed={() => handleStartGenerate(pendingParams, completenessResult)}
          onCancel={() => {
            setCompletenessResult(null)
            setPendingParams(null)
          }}
        />
      )}

      {/* AI 生成遮罩 */}
      {generating && <SummaryGeneratingOverlay />}
    </div>
  )
}

function EmptyState() {
  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      height: '100%',
      color: '#B0ADA6',
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
    weekly:    '周报',
    monthly:   '月报',
    quarterly: '季报',
    annual:    '年报/述职',
    adhoc:     '临时汇报',
  }
  const label = typeLabels[summary.summary_type] ?? '总结'
  const from = summary.date_from.slice(0, 7).replace('-', '年') + '月'
  return `${from}${label}`
}
