# Task 04 · Onboarding AI 对话 + 数据写入

> 完成本 task 后再开始 task 05。
> 完成标准：新用户通过 5–8 轮对话后，AI 生成汇报框架和记录维度，用户确认后数据写入 Supabase，三个 Tab 显示已填内容，底部出现跳转按钮。

---

## 前置要求

- Task 02、03 已完成并验收通过
- `AiSidePanel.tsx` 已存在
- Supabase 中 `user_profiles`、`report_nodes`、`dimensions` 表已建好（含 RLS）
- `/lib/prompts.ts` 中已有 `PROMPTS.profile_new_user`

---

## 这次要做什么

### 1. 更新 AiMessage 类型

**修改 `/types/index.ts`**，扩展 `AiMessage`：

```typescript
export interface AiMessage {
  role: 'user' | 'assistant'
  content: string
  messageType?: 'text' | 'onboarding_result'  // 新增
  onboardingData?: OnboardingResult            // 新增
}

export interface OnboardingResult {
  type: 'onboarding_result'
  report_nodes: OnboardingReportNode[]
  dimensions: OnboardingDimension[]
}

export interface OnboardingReportNode {
  name: string
  trigger_desc: string | null
  audience: string | null
  time_granularity: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annual' | null
  parent_id: string | null   // null 表示根节点，否则填父节点的 name
  modules: ReportModule[]
}

export interface OnboardingDimension {
  name: string
  icon: string
  level: 1 | 2 | 3
  prompt_text?: string
  children?: OnboardingDimension[]
}
```

---

### 2. API Route：/api/onboarding/chat

**创建 `app/api/onboarding/chat/route.ts`**

这个路由与 `/api/profile/ai-chat` 的区别：它在收到 AI 响应后尝试解析是否为 `onboarding_result` JSON，并在响应中标记。

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { callAI } from '@/lib/ai'
import { AiMessage, OnboardingResult } from '@/types'
import { PROMPTS } from '@/lib/prompts'

export async function POST(req: NextRequest) {
  try {
    const { messages }: { messages: AiMessage[] } = await req.json()

    const content = await callAI(
      messages.map(m => ({ role: m.role, content: m.content })),
      PROMPTS.profile_new_user
    )

    // 尝试解析是否为 onboarding_result JSON
    let onboardingResult: OnboardingResult | null = null
    try {
      const parsed = JSON.parse(content)
      if (parsed?.type === 'onboarding_result') {
        onboardingResult = parsed
      }
    } catch {
      // 不是 JSON，正常对话文字，忽略
    }

    return NextResponse.json({ content, onboardingResult })
  } catch {
    return NextResponse.json(
      { error: 'AI 服务暂时不可用，请稍后重试' },
      { status: 500 }
    )
  }
}
```

---

### 3. 扩展 AiSidePanel：支持 Onboarding 结果卡片

**修改 `components/AiSidePanel.tsx`**

新增两个 Props：

```typescript
interface AiSidePanelProps {
  // ... 原有 props
  onOnboardingComplete?: (result: OnboardingResult) => Promise<void>  // 新增
}
```

`handleSend` 修改：检查响应中的 `onboardingResult`：

```typescript
async function handleSend() {
  const text = input.trim()
  if (!text || sending || ended) return

  const userMsg: AiMessage = { role: 'user', content: text }
  setMessages(prev => [...prev, userMsg])
  setInput('')
  setSending(true)

  try {
    const res = await fetch(apiRoute, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [...messages, userMsg] }),
    })
    const data = await res.json()

    if (data.onboardingResult) {
      // AI 返回了 onboarding_result，展示预览卡片
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.content,
        messageType: 'onboarding_result',
        onboardingData: data.onboardingResult,
      }])
    } else {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.content,
      }])
    }
  } catch {
    setMessages(prev => [...prev, {
      role: 'assistant',
      content: 'AI 服务暂时不可用，请稍后重试。',
    }])
  } finally {
    setSending(false)
  }
}
```

消息渲染中，对 `messageType === 'onboarding_result'` 的消息，渲染预览卡片而不是普通气泡：

```typescript
{messages.map((msg, i) => {
  if (msg.messageType === 'onboarding_result' && msg.onboardingData) {
    return (
      <OnboardingPreviewCard
        key={i}
        data={msg.onboardingData}
        onConfirm={() => onOnboardingComplete?.(msg.onboardingData!)}
      />
    )
  }
  return (
    <div key={i} /* 普通气泡 */>
      {msg.content}
    </div>
  )
})}
```

---

### 4. OnboardingPreviewCard 组件

**创建 `components/profile/OnboardingPreviewCard.tsx`**

这个卡片显示在 AI 对话栏内，展示 AI 生成的汇报框架和记录维度预览，用户确认后写入数据库。

Props：
```typescript
interface OnboardingPreviewCardProps {
  data: OnboardingResult
  onConfirm: () => void
}
```

卡片结构：
```
┌─────────────────────────────────────────┐
│ ✦ AI 已帮你设计好了框架                  │  ← 13px/500，#0F6E56
│                                         │
│ 汇报框架（X 个节点）                     │  ← 11px/500，大写，#B0ADA6
│  · 年度述职 → 季度复盘 → 月报 → 周报    │  ← 12px，#1A1A1A，最多展示 4 个
│                                         │
│ 记录维度（X 个维度）                     │  ← 11px/500，大写，#B0ADA6
│  · 📋 需求分析  · 🗂 项目管理           │  ← 12px，最多展示 4 个
│                                         │
│ [✓ 确认，保存到档案]                    │  ← 绿色按钮，全宽
│ 还想调整什么，继续和我说                  │  ← 12px，#6B6B6B，居中
└─────────────────────────────────────────┘
```

样式：
```typescript
// 卡片容器
<div style={{
  background: '#F0FBF7',
  border: '1px solid #9FE1CB',
  borderRadius: 8,
  padding: 14,
  fontSize: 13,
}}>

// 汇报框架预览：取 name 用「→」连接，最多 4 个节点
const nodeNames = data.report_nodes.slice(0, 4).map(n => n.name).join(' → ')

// 记录维度预览：取一级维度，最多 4 个
const dimNames = data.dimensions.slice(0, 4).map(d => `${d.icon} ${d.name}`)
```

确认按钮状态：
```typescript
const [confirming, setConfirming] = useState(false)
const [confirmed, setConfirmed] = useState(false)

async function handleConfirm() {
  setConfirming(true)
  await onConfirm()   // 外部处理写入逻辑
  setConfirmed(true)
  setConfirming(false)
}
```

按钮文案变化：
- 默认：「✓ 确认，保存到档案」
- confirming：「保存中...」（禁用）
- confirmed：「✓ 已保存到档案」（绿色实心，禁用）

---

### 5. ProfilePage 实现 onOnboardingComplete

**修改 `app/profile/page.tsx`**

新增写入函数和完成状态：

```typescript
const [onboardingDone, setOnboardingDone] = useState(false)
```

写入 Supabase 的函数：

```typescript
async function handleOnboardingComplete(result: OnboardingResult) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  // 1. 更新 user_profiles（标记 onboarding 完成）
  await supabase.from('user_profiles').upsert({
    id: user.id,
    onboarding_completed: true,
  })

  // 2. 写入 report_nodes（按顺序，用 name 解析 parent_id）
  const nameToId: Record<string, string> = {}
  for (let i = 0; i < result.report_nodes.length; i++) {
    const node = result.report_nodes[i]
    const { data } = await supabase.from('report_nodes').insert({
      user_id: user.id,
      name: node.name,
      trigger_desc: node.trigger_desc,
      audience: node.audience,
      modules: node.modules,
      time_granularity: node.time_granularity,
      parent_id: node.parent_id ? (nameToId[node.parent_id] ?? null) : null,
      sort_order: i,
    }).select('id').single()
    if (data) nameToId[node.name] = data.id
  }

  // 3. 写入 dimensions（递归插入，维持 parent_id 关系）
  async function insertDimension(
    dim: OnboardingDimension,
    parentId: string | null,
    sortOrder: number
  ) {
    const { data } = await supabase.from('dimensions').insert({
      user_id: user.id,
      name: dim.name,
      icon: dim.icon ?? '📋',
      level: dim.level,
      parent_id: parentId,
      sort_order: sortOrder,
      prompt_text: dim.prompt_text ?? null,
    }).select('id').single()

    if (data && dim.children) {
      for (let i = 0; i < dim.children.length; i++) {
        await insertDimension(dim.children[i], data.id, i)
      }
    }
  }

  for (let i = 0; i < result.dimensions.length; i++) {
    await insertDimension(result.dimensions[i], null, i)
  }

  // 4. 完成，触发 UI 更新
  setOnboardingDone(true)
  setShowOnboarding(false)
}
```

---

### 6. 完成后的 UI 更新

#### Tab 状态圆点变为已填写（深绿）

`onboardingDone` 为 `true` 时，将三个 Tab 的 `filled` 全部改为 `true`：

```typescript
const tabs = [
  { id: 'profile', label: '职业画像', filled: onboardingDone },
  { id: 'report',  label: '汇报框架', filled: onboardingDone },
  { id: 'dimension', label: '记录维度', filled: onboardingDone },
]
```

Tab 名称旁的状态圆点：
```typescript
<span style={{
  width: 6, height: 6,
  borderRadius: '50%',
  background: tab.filled ? '#1D9E75' : '#D1CEC8',
  display: 'inline-block',
  marginRight: 6,
}} />
```

#### 底部完成状态栏

`onboardingDone` 为 `true` 时，底部状态栏替换为跳转提示：

```typescript
{onboardingDone ? (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 24px',
    borderTop: '1px solid #F0EDE8',
    background: '#F0FBF7',
  }}>
    <span style={{ fontSize: 13, color: '#0F6E56' }}>✓ 职业档案已建立</span>
    <a
      href="/log"
      style={{
        fontSize: 13,
        color: '#1D9E75',
        fontWeight: 500,
        textDecoration: 'none',
      }}
    >
      前往工作日志，开始今天的第一条记录 →
    </a>
  </div>
) : (
  /* 原有底部状态栏（档案尚未完善 / 待完善） */
)}
```

---

### 7. 在 ProfilePage 中更新 AiSidePanel 的 Props

**修改 `app/profile/page.tsx`**：

```typescript
<AiSidePanel
  isOpen={aiOpen}
  onClose={() => setAiOpen(false)}
  contextLabel="已读取：职业画像内容"
  systemPrompt={PROMPTS.profile_new_user}
  apiRoute="/api/onboarding/chat"
  initialMessage="你好！我来帮你建立职业档案，整个过程大概 3–5 分钟。先告诉我——你目前的职位是什么，在哪个行业？"
  onOnboardingComplete={handleOnboardingComplete}
/>
```

---

### 8. 更新 PROMPTS.profile_new_user（与 MVP Spec 对齐）

**修改 `/lib/prompts.ts`**，将 `profile_new_user` 替换为 MVP Spec 12.1 的完整版本：

```typescript
profile_new_user: `
你是 Trace 的初始化顾问，帮助职场人在 5–8 轮对话内设计工作记录体系。

【目标】生成：
1. 汇报框架：层级结构，每层有名称/触发时机/汇报对象/包含模块
2. 记录维度：多层级目录，最小层级有每日记录提示词

【对话策略】
- 每次只问一个问题，口语化，简洁
- 混合选择题（有限选项）+ 开放问题
- 选择题格式：「A. 每周  B. 每月  C. 没有固定周期」
- 先回应用户的回答，再问下一个问题

【收集信息顺序】
① 职位和行业
② 汇报周期（选择题）
③ 汇报对象和他最关心什么
④ 日常工作主要类型（选择题 + 补充）
⑤ 当前写汇报最大痛点
⑥ 职业方向（可选）

【生成结果格式】收集完毕后输出 JSON，前后不加任何文字：
{
  "type": "onboarding_result",
  "report_nodes": [
    {
      "name": "年度述职",
      "trigger_desc": "每年12月",
      "audience": "VP / CEO",
      "time_granularity": "annual",
      "parent_id": null,
      "modules": [
        {"id":"m1","name":"全年核心贡献","description":"主导项目交付结果与影响"},
        {"id":"m2","name":"个人成长","description":"能力提升与关键经历"}
      ]
    }
  ],
  "dimensions": [
    {
      "name": "需求分析", "icon": "📋", "level": 1,
      "children": [
        {
          "name": "日常需求", "level": 2,
          "children": [
            {"name":"今日进展","level":3,"prompt_text":"今天在需求侧做了什么？推进到哪了？"}
          ]
        }
      ]
    }
  ]
}

【注意】
- 维度名称结合用户实际职位，不用「工作进展」这类通用词
- prompt_text 要有引导性，像了解情况的同事在追问
- 没有固定汇报需求的用户，只生成「月度自我复盘」一个节点
- report_nodes 按层级顺序排列（最高层在前），子节点的 parent_id 填父节点的 name 字段
`.trim(),
```

---

## 不做什么

```
❌ Tab 内容区的真实数据展示（task 05、06、07 做）
❌ 老用户进入时的 AI 上下文切换（task 08 做）
❌ Tab 切换时对话保护弹窗（task 08 做）
❌ 「结束对话」时对未采纳预览的处理（task 08 做）
❌ /log 或 /summary 任何内容
```

---

## 完成标准

```
□ 新用户点「✦ 和 AI 一起填写」→ 弹窗关闭，AI 面板打开，AI 自动发开场白
□ 5–8 轮对话后，AI 返回 onboarding_result JSON
□ 面板内出现预览卡片（汇报框架节点名 + 记录维度名）
□ 点「✓ 确认，保存到档案」→ 按钮变「保存中...」→「✓ 已保存到档案」
□ Supabase 中 report_nodes 表有新记录，parent_id 关系正确
□ Supabase 中 dimensions 表有新记录，三级结构 parent_id 正确
□ user_profiles 中 onboarding_completed = true
□ 三个 Tab 名称旁圆点变为深绿色
□ 底部状态栏变为绿色「✓ 职业档案已建立」+ 跳转链接
□ 点「前往工作日志 →」能跳到 /log（页面可空，后续 task 做）
□ 无 TypeScript 报错
□ npm run dev 无报错
```

---

## 做完后告诉我

1. 做了哪些文件
2. Supabase 写入是否成功（report_nodes 和 dimensions 的 parent_id 层级是否正确）
3. 不要自动开始 task 05，等我验收

---

*Task 04 | 2026.04.24*
