# Task 08 · Profile AI 助手（老用户上下文 + Tab 切换保护）

> 这是 /profile 模块的最后一个 task。
> 完成标准：老用户 AI 助手根据当前 Tab 自动加载对应上下文，Tab 切换有对话时弹确认框，新老用户使用不同的 AI 配置。

---

## 前置要求

- Task 03、05、06、07 均已完成并验收通过
- `AiSidePanel.tsx` 已存在
- `PROMPTS` 已在 `/lib/prompts.ts` 定义

---

## 这次要做什么

### 1. ProfilePage 拉取完整数据

目前 ProfilePage 只拉取了 `user_profiles`。AI 上下文需要三张表的数据。

**修改 `app/profile/page.tsx`**，在已有的 `useEffect` 内，并发拉取三张表：

```typescript
const [profile, setProfile] = useState<UserProfile | null>(null)
const [reportNodes, setReportNodes] = useState<ReportNode[]>([])
const [dimensions, setDimensions] = useState<Dimension[]>([])

// 在 checkNewUser 函数内，替换原有的单表查询：
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

const isNew =
  !profileRes.data?.job_title &&
  (nodesRes.data?.length ?? 0) === 0 &&
  (dimsRes.data?.length ?? 0) === 0

setShowOnboarding(isNew)
setCheckingUser(false)
```

---

### 2. 更新 PROMPTS.profile_existing（Prompt 12.5 完整版）

**修改 `/lib/prompts.ts`**，将 `profile_existing` 替换为带占位符的完整版本：

```typescript
profile_existing: `
你是职业顾问，帮用户完善职业档案。根据用户当前查看的 Tab 切换任务：

【职业画像 Tab】
已有信息：{profile_data}
任务：帮用户润色工作职责表达，或梳理职业方向。
- 润色职责：只改表达，不改事实
- 梳理方向：有专业主动性，用户只有短期目标时引导设中长期，只有长期目标时帮拆短期行动

【汇报框架 Tab】
已有框架：{report_framework}
任务：帮用户优化汇报框架结构。
- 发现缺失常见层级时主动提醒
- 不只顺从，要有专业判断

【记录维度 Tab】
已有维度：{dimensions}
用户职位：{job_title}
任务：帮用户调整维度结构，确保日常记录能支撑汇报需求。
- 维度太宽泛时帮拆细
- 发现工作内容没被覆盖时补充建议
`.trim(),
```

---

### 3. 按 Tab 格式化 AI 上下文数据

在 `app/profile/page.tsx` 中，定义三个格式化函数，将数据转换为 AI 可读的字符串，注入到 Prompt 占位符中。

**formatProfileData**（职业画像 Tab）：

```typescript
function formatProfileData(p: UserProfile | null): string {
  if (!p) return '暂无数据'
  const lines = [
    p.job_title       && `职位：${p.job_title}`,
    p.industry        && `行业：${p.industry}`,
    p.work_years      && `工作年限：${p.work_years} 年`,
    p.company_size    && `公司规模：${p.company_size}`,
    p.job_responsibilities && `\n工作职责：\n${p.job_responsibilities}`,
    p.career_direction && `\n职业方向：\n${p.career_direction}`,
    p.skill_focus      && `技能重点：${p.skill_focus}`,
  ].filter(Boolean)
  return lines.join('\n') || '暂无数据'
}
```

**formatReportFramework**（汇报框架 Tab）：

```typescript
function formatReportFramework(nodes: ReportNode[]): string {
  if (nodes.length === 0) return '暂无汇报框架'
  return nodes.map(n => {
    const moduleNames = n.modules.map(m => m.name).join('、')
    return [
      `【${n.name}】`,
      n.trigger_desc && `  触发时机：${n.trigger_desc}`,
      n.audience     && `  汇报对象：${n.audience}`,
      moduleNames    && `  包含模块：${moduleNames}`,
    ].filter(Boolean).join('\n')
  }).join('\n\n')
}
```

**formatDimensions**（记录维度 Tab）：

```typescript
function formatDimensions(dims: Dimension[]): string {
  if (dims.length === 0) return '暂无记录维度'

  // 只展示叶节点及其路径，AI 更容易理解
  const leaves = dims.filter(d => d.level === 3)
  if (leaves.length === 0) {
    return dims.map(d => `${'  '.repeat(d.level - 1)}${d.name}`).join('\n')
  }

  return leaves.map(leaf => {
    const parent = dims.find(d => d.id === leaf.parent_id)
    const grandParent = parent ? dims.find(d => d.id === parent.parent_id) : null
    const path = [grandParent?.name, parent?.name, leaf.name].filter(Boolean).join(' > ')
    return `${path}${leaf.prompt_text ? `（提示词：${leaf.prompt_text}）` : ''}`
  }).join('\n')
}
```

---

### 4. 按 Tab 计算 contextLabel 和 systemPrompt

在 `app/profile/page.tsx` 中，定义一个根据 `activeTab` 返回 AI 配置的函数：

```typescript
function getAiConfig(tab: string) {
  const isOldUser = profile?.onboarding_completed

  if (!isOldUser) {
    // 新用户：Onboarding 配置（Task 04 已实现）
    return {
      contextLabel: '已读取：职业画像（空）',
      systemPrompt: PROMPTS.profile_new_user,
      apiRoute: '/api/onboarding/chat',
      initialMessage: '你好！我来帮你建立职业档案，整个过程大概 3–5 分钟。先告诉我——你目前的职位是什么，在哪个行业？',
    }
  }

  // 老用户：按 Tab 切换上下文
  const baseGreeting = '你好！我已读取你的职业档案。你想调整什么？'

  if (tab === 'profile') {
    const profileData = formatProfileData(profile)
    return {
      contextLabel: `已读取：职业画像（${profile?.job_title ?? '未填写职位'}）`,
      systemPrompt: PROMPTS.profile_existing
        .replace('{profile_data}', profileData)
        .replace('{report_framework}', '')
        .replace('{dimensions}', '')
        .replace('{job_title}', profile?.job_title ?? ''),
      apiRoute: '/api/profile/ai-chat',
      initialMessage: baseGreeting,
    }
  }

  if (tab === 'report') {
    const framework = formatReportFramework(reportNodes)
    return {
      contextLabel: `已读取：汇报框架（${reportNodes.length} 个节点）`,
      systemPrompt: PROMPTS.profile_existing
        .replace('{profile_data}', '')
        .replace('{report_framework}', framework)
        .replace('{dimensions}', '')
        .replace('{job_title}', profile?.job_title ?? ''),
      apiRoute: '/api/profile/ai-chat',
      initialMessage: baseGreeting,
    }
  }

  // tab === 'dimension'
  const dimText = formatDimensions(dimensions)
  return {
    contextLabel: `已读取：记录维度（${dimensions.filter(d => d.level === 1).length} 个一级维度）`,
    systemPrompt: PROMPTS.profile_existing
      .replace('{profile_data}', '')
      .replace('{report_framework}', '')
      .replace('{dimensions}', dimText)
      .replace('{job_title}', profile?.job_title ?? ''),
    apiRoute: '/api/profile/ai-chat',
    initialMessage: baseGreeting,
  }
}
```

---

### 5. Tab 切换时重置 AiSidePanel（key 方案）

给 `AiSidePanel` 加 `key={activeTab}`，Tab 切换时 React 自动重建组件，清空对话历史：

```typescript
<AiSidePanel
  key={activeTab}                      // ← 新增，Tab 切换时重置面板状态
  isOpen={aiOpen}
  onClose={() => setAiOpen(false)}
  {...getAiConfig(activeTab)}
  onOnboardingComplete={handleOnboardingComplete}
  onConversationStateChange={setAiConversationState}
/>
```

---

### 6. AiSidePanel 暴露对话状态

**修改 `components/AiSidePanel.tsx`**，新增 prop：

```typescript
interface AiConversationState {
  hasMessages: boolean
  isEnded: boolean
  hasPendingPreview: boolean
}

interface AiSidePanelProps {
  // ... 原有 props
  onConversationStateChange?: (state: AiConversationState) => void   // 新增
}
```

每次 `messages` 或 `ended` 变化时通知父组件：

```typescript
useEffect(() => {
  onConversationStateChange?.({
    hasMessages: messages.length > 0,
    isEnded: ended,
    hasPendingPreview: messages.some(m => m.messageType === 'onboarding_result' && !m.confirmed),
  })
}, [messages, ended])
```

> `m.confirmed` 需在 `OnboardingPreviewCard` 确认后更新对应消息（在 AiSidePanel 的 messages state 里将该消息标记为 `confirmed: true`）。这是为让 B 情况判断生效。将 `AiMessage` 类型再增加一个可选字段 `confirmed?: boolean`。

**修改 `/types/index.ts`** 的 `AiMessage`：

```typescript
export interface AiMessage {
  role: 'user' | 'assistant'
  content: string
  messageType?: 'text' | 'onboarding_result'
  onboardingData?: OnboardingResult
  confirmed?: boolean    // 新增：onboarding_result 卡片是否已被确认
}
```

`OnboardingPreviewCard` 确认后，`AiSidePanel` 将该消息标记 `confirmed: true`。在 `AiSidePanel` 中，将 `onOnboardingComplete` 包一层：

```typescript
async function handleOnboardingConfirm(data: OnboardingResult, msgIndex: number) {
  await onOnboardingComplete?.(data)
  // 标记该消息为已确认
  setMessages(prev => prev.map((m, i) =>
    i === msgIndex ? { ...m, confirmed: true } : m
  ))
}
```

消息渲染时传入 `msgIndex`：

```typescript
{messages.map((msg, i) => {
  if (msg.messageType === 'onboarding_result' && msg.onboardingData) {
    return (
      <OnboardingPreviewCard
        key={i}
        data={msg.onboardingData}
        confirmed={msg.confirmed}
        onConfirm={() => handleOnboardingConfirm(msg.onboardingData!, i)}
      />
    )
  }
  // ... 普通气泡
})}
```

**修改 `OnboardingPreviewCard`**，接收 `confirmed` prop，如果为 `true` 直接显示「✓ 已保存到档案」状态，按钮禁用：

```typescript
interface OnboardingPreviewCardProps {
  data: OnboardingResult
  confirmed?: boolean      // 新增
  onConfirm: () => void
}
```

---

### 7. Tab 切换保护逻辑

**修改 `app/profile/page.tsx`**，拦截 Tab 切换：

新增状态：

```typescript
const [aiConversationState, setAiConversationState] = useState<AiConversationState>({
  hasMessages: false,
  isEnded: false,
  hasPendingPreview: false,
})
const [pendingTab, setPendingTab] = useState<string | null>(null)  // 用户想切换到的 Tab
```

Tab 点击时，先判断对话状态：

```typescript
function handleTabClick(tabId: string) {
  if (tabId === activeTab) return

  const { hasMessages, isEnded, hasPendingPreview } = aiConversationState

  // 情况 A：对话为空 或 已结束 → 直接切换
  if (!hasMessages || isEnded) {
    setActiveTab(tabId)
    return
  }

  // 情况 B：有未采纳预览
  if (hasPendingPreview) {
    setPendingTab(tabId)
    setTabSwitchDialogType('pending_preview')
    return
  }

  // 情况 C：对话进行中，无未采纳预览
  setPendingTab(tabId)
  setTabSwitchDialogType('in_progress')
}

const [tabSwitchDialogType, setTabSwitchDialogType] = useState<'pending_preview' | 'in_progress' | null>(null)
```

---

### 8. TabSwitchDialog 组件

**创建 `components/profile/TabSwitchDialog.tsx`**

```typescript
interface TabSwitchDialogProps {
  type: 'pending_preview' | 'in_progress'
  onConfirm: () => void     // 确认切换
  onCancel: () => void      // 留在这里
}

export default function TabSwitchDialog({ type, onConfirm, onCancel }: TabSwitchDialogProps) {
  const isPendingPreview = type === 'pending_preview'

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 60,
      backgroundColor: 'rgba(0,0,0,0.2)',
      backdropFilter: 'blur(2px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: '#FFFFFF',
        border: '1px solid #E8E4DD',
        borderRadius: 10,
        padding: '24px 28px',
        width: 360,
        boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
      }}>
        <p style={{ fontSize: 14, color: '#1A1A1A', lineHeight: 1.7, marginBottom: 20 }}>
          {isPendingPreview
            ? '你有一条 AI 整理结果还未采纳，切换后将丢失。'
            : '你和 AI 的对话还未结束，切换后对话记录将被清除。'}
        </p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{
              fontSize: 13, color: '#6B6B6B',
              border: '1px solid #E8E4DD', borderRadius: 7,
              padding: '6px 16px', background: 'transparent', cursor: 'pointer',
            }}
          >
            留在这里
          </button>
          {isPendingPreview && (
            <button
              onClick={onCancel}   // 「先采纳」= 留在这里让用户自己点采纳
              style={{
                fontSize: 13, color: '#0F6E56',
                border: '1px solid #9FE1CB', borderRadius: 7,
                padding: '6px 16px', background: '#E8F7F2', cursor: 'pointer',
              }}
            >
              先采纳
            </button>
          )}
          <button
            onClick={onConfirm}
            style={{
              fontSize: 13, color: '#FFFFFF',
              border: 'none', borderRadius: 7,
              padding: '6px 16px',
              background: isPendingPreview ? '#D94F4F' : '#1A1A1A',
              cursor: 'pointer',
            }}
          >
            {isPendingPreview ? '放弃并切换' : '确认切换'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

在 `app/profile/page.tsx` 中挂载，处理确认/取消：

```typescript
import TabSwitchDialog from '@/components/profile/TabSwitchDialog'

// JSX 末尾：
{tabSwitchDialogType && pendingTab && (
  <TabSwitchDialog
    type={tabSwitchDialogType}
    onConfirm={() => {
      setActiveTab(pendingTab)
      setPendingTab(null)
      setTabSwitchDialogType(null)
    }}
    onCancel={() => {
      setPendingTab(null)
      setTabSwitchDialogType(null)
    }}
  />
)}
```

将 Tab 的 `onClick` 从原来的 `setActiveTab(tab.id)` 换成 `handleTabClick(tab.id)`。

---

### 9. 老用户进入 /profile 时 AI 不自动打开

老用户（`profile?.onboarding_completed === true`）进入时，AI 面板保持关闭，用户主动点才开。检查方式：`showOnboarding` 为 `false` 且 `profile?.onboarding_completed` 为 `true`，则不调用 `setAiOpen(true)`。

Task 02 中 `onWithAI` 回调里有 `setAiOpen(true)`，这是新用户 Onboarding 的行为，保持不变。老用户没有这个触发路径，因此无需额外处理。

---

### 10. 左侧导航跳转时清空对话历史

Spec 6.4 ④：点击左侧导航跳转页面 → 自动收起，对话历史清空（跨页面不保留）。

由于导航使用 Next.js `<Link>`，跳转时页面整体重新挂载，`AiSidePanel` state 自然清空，无需额外处理。

---

## 不做什么

```
❌ /log 和 /summary 页面的 AI 接入（后续 task 做）
❌ 流式输出（全局统一不做）
❌ AI 对话内容的持久化（spec 规定存 session 内存，关闭即消失，不写数据库）
❌ 「结束对话」后面板收起行为的变更（现有行为已足够）
```

---

## 完成标准

```
□ 老用户进入 /profile → 不弹 Onboarding 弹窗，AI 面板不自动打开
□ 点「✦ AI 助手」→ 面板打开，老用户开场白「你好！我已读取你的职业档案。你想调整什么？」
□ 职业画像 Tab 下：绿色横幅显示「已读取：职业画像（xxx职位）」，AI 能回答职责/方向相关问题
□ 汇报框架 Tab 下：横幅显示「已读取：汇报框架（N 个节点）」，AI 能讨论框架优化
□ 记录维度 Tab 下：横幅显示「已读取：记录维度（N 个一级维度）」，AI 能讨论维度调整
□ 对话为空时切 Tab → 直接切换，无弹窗，面板重置（key 机制）
□ 对话进行中切 Tab（情况 C）→ 弹确认框「你和 AI 的对话还未结束...」
□ 确认切换 → 切换成功，对话清空
□ 留在这里 → Tab 不切换，对话继续
□ 有未采纳 Onboarding 预览时切 Tab（情况 B）→ 弹框含「先采纳」「放弃并切换」
□ onConversationStateChange 回调在 messages/ended 变化时触发
□ Onboarding 预览卡片确认后 confirmed = true，切 Tab 不再触发 B 情况
□ 无 TypeScript 报错
□ npm run dev 无报错
```

---

## 做完后告诉我

1. 做了哪些文件
2. 老用户的 AI 上下文是否按 Tab 正确切换（横幅文字变了吗）
3. Tab 切换保护弹窗的三种情况是否都能正确触发
4. 不要自动开始 task 09，等我验收

---

*Task 08 | 2026.04.24*
