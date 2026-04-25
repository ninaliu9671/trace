'use client'

import { useEffect, useState } from 'react'
import Sidebar from '@/components/layout/Sidebar'
import AiSidePanel from '@/components/AiSidePanel'
import OnboardingModal from '@/components/profile/OnboardingModal'
import ProfileTabContent from '@/components/profile/ProfileTabContent'
import ReportTabContent from '@/components/profile/ReportTabContent'
import DimensionTabContent from '@/components/profile/DimensionTabContent'
import TabSwitchDialog from '@/components/profile/TabSwitchDialog'

import { createClient } from '@/lib/supabase/client'
import {
  AiConversationState,
  ProfilePreview,
  ProfilePreviewTarget,
  ProfilePreviewReportNode,
  ProfilePreviewDimension,
  UserProfile,
  ReportNode,
  Dimension,
} from '@/types'

export default function ProfilePage() {
  const [activeTab, setActiveTab] = useState('profile')
  const [aiOpen, setAiOpen] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [checkingUser, setCheckingUser] = useState(true)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [reportNodes, setReportNodes] = useState<ReportNode[]>([])
  const [dimensions, setDimensions] = useState<Dimension[]>([])
  const [isNewUser, setIsNewUser] = useState(false)
  const [currentFocus, setCurrentFocus] = useState<ProfilePreviewTarget | null>(null)
  const [allAdopted, setAllAdopted] = useState(false)
  const [reportRefreshKey, setReportRefreshKey] = useState(0)
  const [dimensionRefreshKey, setDimensionRefreshKey] = useState(0)

  const [aiConversationState, setAiConversationState] = useState<AiConversationState>({
    hasMessages: false,
    isEnded: false,
    hasPendingPreview: false,
  })
  const [pendingTab, setPendingTab] = useState<string | null>(null)
  const [showTabSwitchDialog, setShowTabSwitchDialog] = useState(false)
  const [autoSendMessage, setAutoSendMessage] = useState<string | null>(null)

  const profileFilled = !!(profile?.job_title)
  const reportFilled = reportNodes.length > 0
  const dimensionFilled = dimensions.length > 0

  const tabs = [
    { id: 'profile', label: '职业画像', filled: profileFilled },
    { id: 'report', label: '汇报框架', filled: reportFilled },
    { id: 'dimension', label: '记录维度', filled: dimensionFilled },
  ]

  useEffect(() => {
    if (profileFilled && reportFilled && dimensionFilled) {
      setAllAdopted(true)
    }
  }, [profileFilled, reportFilled, dimensionFilled])

  useEffect(() => {
    async function checkNewUser() {
      if (sessionStorage.getItem('onboarding_dismissed')) {
        setCheckingUser(false)
        return
      }

      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setCheckingUser(false); return }

      const [profileRes, nodesRes, dimsRes, allNodesRes, allDimsRes] = await Promise.all([
        supabase.from('user_profiles').select('*').eq('id', user.id).single(),
        supabase.from('report_nodes').select('id').eq('user_id', user.id).limit(1),
        supabase.from('dimensions').select('id').eq('user_id', user.id).limit(1),
        supabase.from('report_nodes').select('*').eq('user_id', user.id).eq('is_active', true).order('sort_order'),
        supabase.from('dimensions').select('*').eq('user_id', user.id).eq('is_active', true).order('sort_order'),
      ])

      setProfile(profileRes.data)
      setReportNodes(allNodesRes.data ?? [])
      setDimensions(allDimsRes.data ?? [])

      const newUser =
        !profileRes.data?.job_title &&
        (nodesRes.data?.length ?? 0) === 0 &&
        (dimsRes.data?.length ?? 0) === 0

      setIsNewUser(newUser)
      setShowOnboarding(newUser)
      setCheckingUser(false)
    }
    checkNewUser()
  }, [])

  function handleDismiss() {
    sessionStorage.setItem('onboarding_dismissed', '1')
    setShowOnboarding(false)
  }

  function openAiWithTrigger(message: string) {
    setAiOpen(true)
    setAutoSendMessage(message)
  }

  function handleTabClick(tabId: string) {
    if (tabId === activeTab) return

    // v7: 仅有未采纳预览时才弹提示，in_progress 直接切换
    if (aiConversationState.hasPendingPreview) {
      setPendingTab(tabId)
      setShowTabSwitchDialog(true)
      return
    }

    setActiveTab(tabId)
  }

  // 采纳预览后写入数据库
  async function handlePreviewAdopt(preview: ProfilePreview) {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('未登录')

    async function safeFetch(url: string, body: unknown): Promise<unknown> {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || `请求失败 (${res.status})`)
      return data
    }

    try {
    if (preview.target === 'profile') {
      const content = preview.content as Record<string, unknown>
      await safeFetch('/api/profile/update', content)
      const { data } = await supabase.from('user_profiles').select('*').eq('id', user.id).single()
      setProfile(data)
    }

    if (preview.target === 'report') {
      const nodes = preview.content as ProfilePreviewReportNode[]
      const nameToId: Record<string, string> = {}
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i]
        const parentId = node.parent_id ? (nameToId[node.parent_id] ?? null) : null
        const saved = await safeFetch('/api/report-nodes/save', {
          name: node.name,
          trigger_desc: node.trigger_desc ?? null,
          audience: node.audience ?? null,
          modules: node.modules ?? [],
          time_granularity: node.time_granularity ?? null,
          parent_id: parentId,
          sort_order: i,
        }) as { node?: { id: string } }
        if (saved.node?.id) nameToId[node.name] = saved.node.id
      }
      const { data } = await supabase.from('report_nodes').select('*').eq('user_id', user.id).eq('is_active', true).order('sort_order')
      setReportNodes(data ?? [])
      setReportRefreshKey(k => k + 1)
    }

    if (preview.target === 'dimension') {
      const dims = preview.content as ProfilePreviewDimension[]

      async function insertDim(dim: ProfilePreviewDimension, parentId: string | null, sortOrder: number) {
        const saved = await safeFetch('/api/dimensions/save', {
          name: dim.name,
          icon: dim.icon ?? '📋',
          level: dim.level,
          parent_id: parentId,
          sort_order: sortOrder,
          prompt_text: dim.level === 3 ? (dim.prompt_text ?? null) : null,
        }) as { dimension?: { id: string } }
        if (saved.dimension?.id && dim.children) {
          for (let i = 0; i < dim.children.length; i++) {
            await insertDim(dim.children[i], saved.dimension.id, i)
          }
        }
      }

      for (let i = 0; i < dims.length; i++) {
        await insertDim(dims[i], null, i)
      }

      const { data } = await supabase.from('dimensions').select('*').eq('user_id', user.id).eq('is_active', true).order('sort_order')
      setDimensions(data ?? [])
      setDimensionRefreshKey(k => k + 1)
    }

    // 三项都完成后标记 onboarding_completed
    const newProfileFilled = preview.target === 'profile' ? true : profileFilled
    const newReportFilled  = preview.target === 'report'  ? true : reportFilled
    const newDimsFilled    = preview.target === 'dimension' ? true : dimensionFilled
    if (newProfileFilled && newReportFilled && newDimsFilled && isNewUser) {
      await safeFetch('/api/profile/update', { onboarding_completed: true })
      setIsNewUser(false)
    }
    } catch (e) {
      throw new Error((e as Error).message || '内容写入失败，请稍后重试')
    }
  }

  const contextLabel = '已读取：职业画像 · 汇报框架 · 记录维度'

  function buildInitialMessage(): string {
    if (isNewUser) {
      return '你好！我来帮你建立一套专属的职业档案。\n\n完成后你会得到：\n• 一份职业画像\n• 一套汇报框架\n• 一个日志维度模板\n\n先从你的工作开始——能简单介绍一下吗？职位、行业、做了几年、主要负责什么，一起说都行，我来整理。'
    }
    if (profileFilled && reportFilled && dimensionFilled) {
      return '你好！我已读取你的完整职业档案，包括职业画像、汇报框架和记录维度。\n你今天想调整哪个部分？\nA. 职业画像　B. 汇报框架　C. 记录维度'
    }
    const filled = [profileFilled && '职业画像', reportFilled && '汇报框架', dimensionFilled && '记录维度'].filter(Boolean).join('、')
    const missing = [!profileFilled && '职业画像', !reportFilled && '汇报框架', !dimensionFilled && '记录维度'].filter(Boolean).join('、')
    return `你好！我已读取你的档案。\n已完成：${filled || '暂无'}；待完善：${missing}。\n你想从哪部分继续？`
  }

  const initialMessage = checkingUser ? undefined : buildInitialMessage()

  return (
    <div className="flex min-h-screen bg-[#F8F7F4] text-[#1A1A1A]">
      <Sidebar />

      <main
        className="flex min-w-0 flex-1 flex-col"
        style={{
          marginRight: aiOpen ? 280 : 0,
          transition: 'margin-right 0.2s ease',
        }}
      >
        <div className="flex flex-1 flex-col px-[22px] py-[20px]">
          <header className="mb-[16px] flex items-start justify-between gap-[12px]">
            <div>
              <h1 className="text-[16px] font-medium text-[#1A1A1A]">职业档案</h1>
              <p className="mt-[4px] text-[12px] text-[#6B6B6B]">
                建立你的职业画像、汇报框架和记录维度。
              </p>
            </div>

            <button
              type="button"
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
          </header>

          {/* Tab 导航 */}
          <div className="mb-[2px] flex border-b border-[#E8E4DD]">
            {tabs.map((tab) => {
              const isActive = tab.id === activeTab
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleTabClick(tab.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '9px 14px',
                    fontSize: 13,
                    cursor: 'pointer',
                    borderBottom: `2px solid ${isActive ? '#1D9E75' : 'transparent'}`,
                    marginBottom: -1,
                    color: isActive ? '#1D9E75' : '#6B6B6B',
                    fontWeight: isActive ? 500 : 400,
                    background: 'transparent',
                    border: 'none',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <span style={{
                    width: 5,
                    height: 5,
                    borderRadius: '50%',
                    background: tab.filled ? '#1D9E75' : '#E8E4DD',
                    display: 'inline-block',
                    flexShrink: 0,
                  }} />
                  {tab.label}
                </button>
              )
            })}
          </div>

          {/* Tab 内容区 */}
          <div className="flex-1 overflow-y-auto rounded-b-[11px] border border-t-0 border-[#E8E4DD] bg-white">
            {activeTab === 'profile' && (
              <ProfileTabContent
                profile={profile}
                onProfileUpdate={(updated) => setProfile(prev => ({ ...(prev ?? {} as UserProfile), ...updated }))}
              />
            )}
            {activeTab === 'report' && (
              <ReportTabContent
                key={reportRefreshKey}
                onOpenAiPanel={(msg) => openAiWithTrigger(msg)}
                onNodesChange={(nodes) => setReportNodes(nodes)}
              />
            )}
            {activeTab === 'dimension' && (
              <DimensionTabContent
                key={dimensionRefreshKey}
                onOpenAiPanel={(msg) => openAiWithTrigger(msg)}
                onDimsChange={(dims) => setDimensions(dims)}
              />
            )}
          </div>

          {/* 底部状态栏 */}
          <div className="mt-[12px]">
            {allAdopted ? (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 15px',
                background: '#F0FBF7',
                borderRadius: 11,
                border: '1px solid #9FE1CB',
              }}>
                <span style={{ fontSize: 13, color: '#0F6E56' }}>✓ 职业档案已建立</span>
                <a href="/log" style={{ fontSize: 13, color: '#1D9E75', fontWeight: 500, textDecoration: 'none' }}>
                  前往工作日志，开始今天的第一条记录 →
                </a>
              </div>
            ) : (
              <div className="flex items-center justify-between rounded-[11px] border border-[#E8E4DD] bg-[#FAFAF8] px-[15px] py-[12px] text-[12px]">
                <span className="text-[#6B6B6B]">档案尚未完善</span>
                <span className="font-medium text-[#F59E0B]">● 待完善</span>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* v7: 不带 key={activeTab}，切 Tab 保留对话历史 */}
      <AiSidePanel
        isOpen={aiOpen}
        onClose={() => setAiOpen(false)}
        contextLabel={contextLabel}
        apiRoute="/api/profile/ai-chat"
        initialMessage={initialMessage}
        autoSendMessage={autoSendMessage}
        onAutoSendConsumed={() => setAutoSendMessage(null)}
        isNewUser={isNewUser}
        profileData={profile}
        reportNodes={reportNodes}
        dimensions={dimensions}
        currentFocus={currentFocus}
        onCurrentFocusChange={setCurrentFocus}
        onPreviewAdopt={handlePreviewAdopt}
        onConversationStateChange={setAiConversationState}
      />

      {!checkingUser && showOnboarding && (
        <OnboardingModal
          onWithAI={() => {
            setShowOnboarding(false)
            setAiOpen(true)
          }}
          onSelf={() => setShowOnboarding(false)}
          onDismiss={handleDismiss}
        />
      )}

      {showTabSwitchDialog && pendingTab && (
        <TabSwitchDialog
          onConfirm={() => {
            setActiveTab(pendingTab)
            setPendingTab(null)
            setShowTabSwitchDialog(false)
          }}
          onCancel={() => {
            setPendingTab(null)
            setShowTabSwitchDialog(false)
          }}
        />
      )}
    </div>
  )
}
