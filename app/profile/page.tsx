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
  DimensionOperation,
  DimensionOpsPreview,
  ProfilePreview,
  ProfilePreviewTarget,
  ProfilePreviewReportNode,
  ProfilePreviewDimension,
  UserProfile,
  ReportNode,
  Dimension,
} from '@/types'
import { buildDimensionNumberMap, validateAndNormalizeDimensionOps } from '@/lib/dimension-ops'

type NestedAddNode = {
  level?: number
  name?: string
  icon?: string
  prompt_text?: string | null
  to_index?: number
  children?: NestedAddNode[]
}

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
  const allAdopted = profileFilled && reportFilled && dimensionFilled

  const tabs = [
    { id: 'profile', label: '职业画像', filled: profileFilled },
    { id: 'report', label: '汇报框架', filled: reportFilled },
    { id: 'dimension', label: '记录维度', filled: dimensionFilled },
  ]

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
  async function handlePreviewAdopt(preview: ProfilePreview | DimensionOpsPreview) {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('未登录')
    const userId = user.id

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

    function collectDescendantIds(rootId: string, allDims: Dimension[]): Set<string> {
      const childrenMap = new Map<string, string[]>()
      for (const d of allDims) {
        if (!d.parent_id) continue
        const list = childrenMap.get(d.parent_id) ?? []
        list.push(d.id)
        childrenMap.set(d.parent_id, list)
      }
      const out = new Set<string>()
      const stack = [rootId]
      while (stack.length > 0) {
        const cur = stack.pop()
        if (!cur || out.has(cur)) continue
        out.add(cur)
        stack.push(...(childrenMap.get(cur) ?? []))
      }
      return out
    }

    async function normalizeSortOrder(currentDims: Dimension[]) {
      const parentIds = [...new Set(currentDims.map(d => d.parent_id ?? '__root__'))]
      for (const pid of parentIds) {
        const parentId = pid === '__root__' ? null : pid
        const siblings = currentDims
          .filter(d => d.parent_id === parentId)
          .sort((a, b) => a.sort_order - b.sort_order)
        for (let i = 0; i < siblings.length; i++) {
          if (siblings[i].sort_order === i) continue
          await safeFetch('/api/dimensions/save', {
            id: siblings[i].id,
            name: siblings[i].name,
            icon: siblings[i].icon ?? '📋',
            level: siblings[i].level,
            parent_id: siblings[i].parent_id,
            sort_order: i,
            prompt_text: siblings[i].level === 3 ? (siblings[i].prompt_text ?? null) : null,
          })
        }
      }
    }

    try {
    if (preview.type === 'profile_preview' && preview.target === 'profile') {
      const content = preview.content as Record<string, unknown>
      await safeFetch('/api/profile/update', content)
      const { data } = await supabase.from('user_profiles').select('*').eq('id', userId).single()
      setProfile(data)
    }

    if (preview.type === 'profile_preview' && preview.target === 'report') {
      const nodes = preview.content as ProfilePreviewReportNode[]
      const nameToId: Record<string, string> = {}
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i]
        const saved = await safeFetch('/api/report-nodes/save', {
          name: node.name,
          audience: node.audience ?? null,
          style: node.style ?? null,
          modules: node.modules ?? [],
          sort_order: i,
        }) as { node?: { id: string } }
        if (saved.node?.id) nameToId[node.name] = saved.node.id
      }
      const { data } = await supabase.from('report_nodes').select('*').eq('user_id', userId).eq('is_active', true).order('sort_order')
      setReportNodes(data ?? [])
      setReportRefreshKey(k => k + 1)
    }

    if (preview.type === 'dimension_ops_preview') {
      const { data: existingDimsRaw } = await supabase
        .from('dimensions')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('sort_order')
      const existingDims = (existingDimsRaw ?? []) as Dimension[]
      const numberMap = buildDimensionNumberMap(existingDims)
      const validated = validateAndNormalizeDimensionOps(preview.operations as DimensionOperation[], existingDims, numberMap)
      if (validated.errors.length > 0) throw new Error(validated.errors.join('；'))
      const ops = validated.normalizedOps

      const deletes = ops.filter(op => op.op === 'delete')
      if (deletes.length > 0) {
        const allToDelete = new Set<string>()
        for (const op of deletes) {
          if (!op.target_id) continue
          for (const id of collectDescendantIds(op.target_id, existingDims)) allToDelete.add(id)
        }
        if (allToDelete.size > 0) {
          const { error } = await supabase
            .from('dimensions')
            .update({ is_active: false })
            .in('id', [...allToDelete])
            .eq('user_id', userId)
          if (error) throw error
        }
      }

      const { data: afterDeleteRaw } = await supabase
        .from('dimensions')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('sort_order')
      let workingDims = (afterDeleteRaw ?? []) as Dimension[]
      let dynamicNumberMap = buildDimensionNumberMap(workingDims)

      for (const op of ops.filter(op => op.op === 'move')) {
        if (!op.target_id) continue
        const target = workingDims.find(d => d.id === op.target_id)
        if (!target) continue
        const toParentId = op.to_parent_id ?? null
        const parent = toParentId ? workingDims.find(d => d.id === toParentId) : null
        const newLevel = (parent ? parent.level + 1 : 1) as 1 | 2 | 3
        if (newLevel > 3) throw new Error('移动后层级超过三级，请调整目标父级。')
        const siblings = workingDims.filter(d => d.parent_id === toParentId && d.id !== target.id)
        const index = Math.max(0, Math.min(op.to_index ?? siblings.length, siblings.length))
        await safeFetch('/api/dimensions/save', {
          id: target.id,
          name: target.name,
          icon: target.icon ?? '📋',
          level: newLevel,
          parent_id: toParentId,
          sort_order: index,
          prompt_text: newLevel === 3 ? (target.prompt_text ?? null) : null,
        })
        const { data } = await supabase.from('dimensions').select('*').eq('user_id', userId).eq('is_active', true).order('sort_order')
        workingDims = (data ?? []) as Dimension[]
        dynamicNumberMap = buildDimensionNumberMap(workingDims)
      }

      for (const op of ops.filter(op => op.op === 'update')) {
        if (!op.target_id) continue
        const target = workingDims.find(d => d.id === op.target_id)
        if (!target) continue
        const fields = op.fields ?? {}
        await safeFetch('/api/dimensions/save', {
          id: target.id,
          name: fields.name ?? op.name ?? target.name,
          icon: fields.icon ?? op.icon ?? target.icon ?? '📋',
          level: target.level,
          parent_id: target.parent_id,
          sort_order: target.sort_order,
          prompt_text: target.level === 3 ? (fields.prompt_text ?? op.prompt_text ?? target.prompt_text ?? null) : null,
        })
      }

      const addOps = ops
        .filter(op => op.op === 'add')
        .sort((a, b) => {
          const da = a.parent_n ? a.parent_n.split('.').length : 0
          const db = b.parent_n ? b.parent_n.split('.').length : 0
          return da - db
        })

      async function createAddNode(node: NestedAddNode, parentId: string | null) {
        const parent = parentId ? workingDims.find(d => d.id === parentId) : null
        const level = node.level ?? (parent ? (parent.level + 1) : 1)
        const siblings = workingDims.filter(d => d.parent_id === parentId)
        const index = Math.max(0, Math.min(node.to_index ?? siblings.length, siblings.length))
        const saved = await safeFetch('/api/dimensions/save', {
          name: node.name ?? '未命名维度',
          icon: node.icon ?? '📋',
          level,
          parent_id: parentId,
          sort_order: index,
          prompt_text: level === 3 ? (node.prompt_text ?? null) : null,
        }) as { dimension?: { id: string } }

        const { data } = await supabase.from('dimensions').select('*').eq('user_id', userId).eq('is_active', true).order('sort_order')
        workingDims = (data ?? []) as Dimension[]
        dynamicNumberMap = buildDimensionNumberMap(workingDims)

        if (!saved.dimension?.id) return
        const children = node.children ?? []
        for (let i = 0; i < children.length; i++) {
          await createAddNode({ ...children[i], to_index: i }, saved.dimension.id)
        }
      }

      for (const op of addOps) {
        const parentIdFromN = op.parent_n ? dynamicNumberMap.numberToId.get(op.parent_n) : null
        const parentId = op.parent_id ?? parentIdFromN ?? null
        if (op.parent_n && !parentId) {
          throw new Error(`新增操作母级不存在：${op.parent_n}`)
        }
        await createAddNode(
          {
            level: op.level,
            name: op.name,
            icon: op.icon,
            prompt_text: op.prompt_text,
            to_index: op.to_index,
            children: (op as DimensionOperation & { children?: NestedAddNode[] }).children ?? [],
          },
          parentId
        )
      }

      await normalizeSortOrder(workingDims)
      const { data } = await supabase.from('dimensions').select('*').eq('user_id', userId).eq('is_active', true).order('sort_order')
      setDimensions((data ?? []) as Dimension[])
      setDimensionRefreshKey(k => k + 1)
    } else if (preview.type === 'profile_preview' && preview.target === 'dimension') {
      const dims = preview.content as ProfilePreviewDimension[]
      const { data: existingDimsRaw } = await supabase
        .from('dimensions')
        .select('id, name, icon, level, parent_id, sort_order, prompt_text, is_active')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('sort_order')

      const existingDims = existingDimsRaw ?? []
      const siblingKey = (parentId: string | null, level: number) => `${parentId ?? 'root'}__${level}`
      const siblingMap = new Map<string, Array<{ id: string; name: string }>>()
      const consumedIds = new Set<string>()
      const keptIds = new Set<string>()

      for (const dim of existingDims) {
        const key = siblingKey(dim.parent_id, dim.level)
        const list = siblingMap.get(key) ?? []
        list.push({ id: dim.id, name: dim.name })
        siblingMap.set(key, list)
      }

      async function upsertDim(dim: ProfilePreviewDimension, parentId: string | null, sortOrder: number) {
        const key = siblingKey(parentId, dim.level)
        const siblings = siblingMap.get(key) ?? []
        const matched = siblings.find(s => s.name === dim.name && !consumedIds.has(s.id))
        const existingId = matched?.id
        if (existingId) consumedIds.add(existingId)

        const saved = await safeFetch('/api/dimensions/save', {
          id: existingId,
          name: dim.name,
          icon: dim.icon ?? '📋',
          level: dim.level,
          parent_id: parentId,
          sort_order: sortOrder,
          prompt_text: dim.level === 3 ? (dim.prompt_text ?? null) : null,
        }) as { dimension?: { id: string } }

        if (!saved.dimension?.id) return
        keptIds.add(saved.dimension.id)

        if (dim.children) {
          for (let i = 0; i < dim.children.length; i++) {
            await upsertDim(dim.children[i], saved.dimension.id, i)
          }
        }
      }

      for (let i = 0; i < dims.length; i++) {
        await upsertDim(dims[i], null, i)
      }

      const toDeactivate = existingDims
        .map(d => d.id)
        .filter(id => !keptIds.has(id))

      if (toDeactivate.length > 0) {
        const { error: deactivateError } = await supabase
          .from('dimensions')
          .update({ is_active: false })
          .in('id', toDeactivate)
          .eq('user_id', userId)
        if (deactivateError) throw deactivateError
      }

      const { data } = await supabase.from('dimensions').select('*').eq('user_id', userId).eq('is_active', true).order('sort_order')
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
