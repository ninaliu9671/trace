# Task 01 · ProfilePage 基础框架 + 全局布局

> 完成本 task 后再开始 task 02。
> 完成标准：页面能跑，三个 Tab 可以切换，样式与 DESIGN.md 一致，无报错。

\---

## 前置要求

开始之前先确认：

* SPEC.md 已读取
* DESIGN.md 已读取
* `npm install openai @supabase/supabase-js @supabase/ssr` 已执行
* `.env.local` 已存在（内容不需要真实，占位即可）

\---

## 这次要做什么

### 1\. 全局基础文件

创建以下文件，这是整个项目的基础，后续所有页面都依赖它们：

**`/lib/supabase/client.ts`**

```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT\_PUBLIC\_SUPABASE\_URL!,
    process.env.NEXT\_PUBLIC\_SUPABASE\_ANON\_KEY!
  )
}
```

**`/lib/supabase/server.ts`**

```typescript
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export function createServerClient() {
  return createSupabaseClient(
    process.env.NEXT\_PUBLIC\_SUPABASE\_URL!,
    process.env.SUPABASE\_SERVICE\_ROLE\_KEY!
  )
}
```

**`/lib/ai.ts`**

```typescript
import OpenAI from 'openai'

const client = new OpenAI({
  baseURL: 'https://api.deepseek.com',
  apiKey: process.env.DEEPSEEK\_API\_KEY,
})

export async function callAI(
  messages: { role: 'user' | 'assistant'; content: string }\[],
  systemPrompt: string,
  temperature = 0.7
): Promise<string> {
  const response = await client.chat.completions.create({
    model: 'deepseek-chat',
    messages: \[
      { role: 'system', content: systemPrompt },
      ...messages,
    ],
    temperature,
  })
  return response.choices\[0].message.content ?? ''
}

export async function callAIStream(
  messages: { role: 'user' | 'assistant'; content: string }\[],
  systemPrompt: string
) {
  return client.chat.completions.create({
    model: 'deepseek-chat',
    messages: \[
      { role: 'system', content: systemPrompt },
      ...messages,
    ],
    stream: true,
  })
}
```

**`/lib/prompts.ts`**

```typescript
// 所有 AI Prompt 集中在这里
// 后续会逐步填充，现在先建好文件

export const PROMPTS = {
  // 职业档案 AI 助手 - 新用户引导
  profile\_new\_user: `
你是 Trace 的初始化顾问，帮助职场人建立工作记录体系。

你的目标：通过 5-8 轮对话，了解用户的职业背景和汇报需求，
生成一套「汇报框架 + 记录维度」。

对话策略：
- 每次只问一个问题，口语化，简洁
- 先用一句话回应用户的回答，让他感觉被理解
- 收集：职位/行业 → 汇报周期 → 汇报对象 → 工作内容 → 痛点 → 职业方向（可选）

收集完信息后，输出 JSON（前后不加任何文字）：
{
  "type": "onboarding\_result",
  "report\_nodes": \[...],
  "dimensions": \[...]
}
  `.trim(),

  // 职业档案 AI 助手 - 老用户
  profile\_existing: `
你是职业顾问，帮用户完善职业档案。
已有信息：{profile\_data}
根据用户当前查看的 Tab，帮助润色工作职责、梳理职业方向、优化汇报框架或调整记录维度。
不只顺从用户，要有专业主动性。
  `.trim(),

  // 工作日志 AI 助手
  log\_assistant: `
你是用户的工作记录助手。
用户的维度结构：{dimensions\_tree}
今天已有的记录：{existing\_logs}

用户会告诉你今天做了什么，你来整理到对应的记录维度字段里。
输出 JSON（前后不加文字）：
{
  "type": "log\_preview",
  "items": \[
    {
      "dimension\_id": "xxx",
      "dimension\_name": "维度名称",
      "content": "整理后的内容"
    }
  ]
}
  `.trim(),

  // 汇报总结生成
  summary\_generate: `
你是职业顾问，帮用户将工作记录整理成汇报总结，输出 Markdown 格式。

汇报框架：{report\_framework}
数据完整度：{completeness}
数据来源：{sources}

要求：
1. 严格按照汇报框架组织章节
2. 从流水账提炼成亮点，不简单堆砌
3. 汇报语气，不是日记语气
4. 只用用户提供的内容，不编造

特殊标注：
- AI 推测：<!-- ai-guess: 推测内容 -->
- 信息缺口：<!-- placeholder: 请补充：缺少什么 -->
  `.trim(),

  // 汇报总结 AI 助手（润色/替换）
  summary\_assistant: `
你是用户工作总结的润色顾问。
当前总结内容：{current\_content}

用户会告诉你想改哪个章节，你给出替换建议。
只改用户指定的部分，不动其他内容，不编造事实。

需要替换时输出 JSON（前后不加文字）：
{
  "type": "replace\_suggestion",
  "target\_section": "「xxx」第x段",
  "original": "原文内容（完整，用于前端匹配）",
  "replacement": "替换后的内容"
}

如果只是聊天，正常文字回复，不输出 JSON。
  `.trim(),
}
```

**`/types/index.ts`**

```typescript
// 所有 TypeScript 类型定义

export interface UserProfile {
  id: string
  job\_title: string | null
  industry: string | null
  work\_years: number | null
  company\_size: string | null
  job\_responsibilities: string | null
  career\_direction: string | null
  skill\_focus: string | null
  onboarding\_completed: boolean
}

export interface ReportNode {
  id: string
  user\_id: string
  name: string
  trigger\_desc: string | null
  audience: string | null
  modules: ReportModule\[]
  parent\_id: string | null
  sort\_order: number
  time\_granularity: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annual' | null
  is\_active: boolean
}

export interface ReportModule {
  id: string
  name: string
  description: string
}

export interface Dimension {
  id: string
  user\_id: string
  name: string
  icon: string
  level: 1 | 2 | 3
  parent\_id: string | null
  sort\_order: number
  prompt\_text: string | null
  is\_active: boolean
  children?: Dimension\[]
}

export interface DailyLog {
  id: string
  user\_id: string
  log\_date: string
  dimension\_id: string
  content: string
  word\_count: number | null
  is\_ai\_generated: boolean
}

export interface Summary {
  id: string
  user\_id: string
  date\_from: string
  date\_to: string
  summary\_type: 'weekly' | 'monthly' | 'quarterly' | 'annual' | 'adhoc'
  title: string | null
  content: string
  report\_node\_id: string | null
  data\_sources: DataSources
  is\_draft: boolean
  finalized\_at: string | null
}

export interface DataSources {
  summaries\_used: string\[]
  logs\_count: number
  completeness: 'complete' | 'partial' | 'logs\_only'
}

export interface AiMessage {
  role: 'user' | 'assistant'
  content: string
}
```

\---

### 2\. 全局布局文件

**修改 `app/globals.css`**，替换成以下内容：

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

\* {
  box-sizing: border-box;
}

body {
  background-color: #F8F7F4;
  color: #1A1A1A;
  font-family: var(--font-dm-sans), system-ui, -apple-system, sans-serif;
  -webkit-font-smoothing: antialiased;
}

/\* 滚动条样式 \*/
::-webkit-scrollbar {
  width: 4px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: #E8E4DD;
  border-radius: 2px;
}
::-webkit-scrollbar-thumb:hover {
  background: #C8C4BD;
}
```

**修改 `app/layout.tsx`**：

```tsx
import type { Metadata } from 'next'
import { DM\_Sans } from 'next/font/google'
import './globals.css'

const dmSans = DM\_Sans({
  subsets: \['latin'],
  variable: '--font-dm-sans',
})

export const metadata: Metadata = {
  title: 'Trace 履迹',
  description: '随手记录每天的工作，AI 整理成随时可用的汇报总结',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body className={dmSans.variable}>
        {children}
      </body>
    </html>
  )
}
```

**修改 `app/page.tsx`**（根路由，只做跳转判断）：

```tsx
import { redirect } from 'next/navigation'

export default function RootPage() {
  // TODO: 后续加入 Supabase Auth 检查
  // 现在先直接跳转 profile（开发阶段）
  redirect('/profile')
}
```

\---

### 3\. 左侧边栏组件

**创建 `components/layout/Sidebar.tsx`**

要求：

* 宽度 172px，固定，背景 #EDEAE4
* 顶部 Logo：「Trace」黑色，「履迹」绿色（#1D9E75）
* 三个导航项，顺序固定：职业档案 / 工作日志 / 汇报总结
* 当前页面对应的导航项激活（绿色背景）
* 职业档案未完善时右侧显示橙色小圆点
* 底部用户信息区（头像 + 用户名，暂时用占位内容）
* 使用 Next.js 的 `usePathname()` 判断当前路由

```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navItems = \[
  { href: '/profile', icon: '◉', label: '职业档案' },
  { href: '/log', icon: '✦', label: '工作日志' },
  { href: '/summary', icon: '◫', label: '汇报总结' },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    // 按照 DESIGN.md 实现侧边栏
    // profileIncomplete 暂时设为 true（开发占位）
  )
}
```

\---

### 4\. 职业档案页面框架

**创建 `app/profile/page.tsx`**

要求：

* 使用 Sidebar 组件
* 顶部：「职业档案」标题 + 副标题 + 右上角「✦ AI 助手」按钮
* 三个 Tab：职业画像 / 汇报框架 / 记录维度
* 每个 Tab 名称左侧有填写状态圆点（暂时全部显示灰色，未填写）
* 切换 Tab 用 useState 控制
* 每个 Tab 内容区先用占位 div（灰色文字，说明「此处是 xxx 内容」）
* AI 助手面板暂时不实现（按钮点击只 console.log，下个 task 做）
* 底部状态栏：「档案尚未完善」+ 橙色「● 待完善」

```tsx
'use client'

import { useState } from 'react'
import Sidebar from '@/components/layout/Sidebar'

const tabs = \[
  { id: 'profile', label: '职业画像', filled: false },
  { id: 'report', label: '汇报框架', filled: false },
  { id: 'dimension', label: '记录维度', filled: false },
]

export default function ProfilePage() {
  const \[activeTab, setActiveTab] = useState('profile')
  const \[aiOpen, setAiOpen] = useState(false)

  return (
    // 按照 DESIGN.md 实现页面布局
    // 三栏布局：Sidebar + 主内容区 + AI 面板占位
  )
}
```

\---

## 不做什么（重要）

```
❌ OnboardingModal 弹窗（task 02 做）
❌ AiSidePanel 组件（task 03 做）
❌ BasicInfoCard 等任何卡片内容（task 04+ 做）
❌ 任何数据库调用
❌ 任何 API 调用
❌ 登录/认证逻辑
❌ /log 和 /summary 页面（后面的 task 做）
❌ 汇报框架和记录维度的空状态组件（后面做）
```

\---

## 完成标准

做完后，你来验收这几件事：

```
□ npm run dev 无报错
□ 访问 localhost:3000，login后自动跳转到 /profile
□ 左侧边栏显示三个导航项，「职业档案」高亮
□ 顶部显示「职业档案」标题和副标题
□ 右上角有「✦ AI 助手」按钮（点击只 console.log）
□ 三个 Tab 可以点击切换
□ 每个 Tab 有占位内容（不是空白）
□ 底部状态栏显示「档案尚未完善」和橙色待完善标识
□ 样式整体符合 DESIGN.md 的颜色和字体规范
□ 没有 TypeScript 报错
```

\---

## 做完后告诉我

完成后请回复：

1. 做了哪些文件
2. 有没有遇到问题或需要确认的地方
3. 不要自动开始做下一个 task，等我验收后再继续

\---

*Task 01 | 2026.04.24*

