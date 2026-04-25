# SPEC.md · Trace 履迹产品规范

> 给 Claude Code 的产品规范文档。每次开始任务前必须先读这个文件。
> 版本：v1.0 | 2026.04.24

---

## 一、产品定位

Trace 帮职场人随手记录每天的工作，AI 整理成随时可用的汇报总结。

用户每天花 2–5 分钟按模板记录，到写周报月报述职的时候，AI 直接生成草稿。

---

## 二、技术栈

```
前端框架：   Next.js 14（App Router）
样式：       Tailwind CSS
数据库：     Supabase（PostgreSQL）
认证：       Supabase Auth
AI 模型：    DeepSeek Chat（接口格式兼容 OpenAI SDK）
部署：       Vercel
语言：       TypeScript（严格模式）
```

---

## 三、路由结构

```
/               → 服务端检查 session
                  有 session → 跳转 /profile
                  无 session → 跳转 /login

/login          → 登录/注册页面（Tab 切换）

/profile        → 职业档案（三个 Tab，新用户落地页）
/log            → 工作日志（默认今天）
/log/[date]     → 指定日期日志
/summary        → 汇报总结列表 + 内容区
```

**路由保护：** middleware.ts 保护 /profile、/log、/summary，未登录自动跳 /login。

**重要：没有 /onboarding 路由。** 新用户引导逻辑集成在 /profile 页面内。

## 三点一、认证规范

```
认证方式：Supabase Auth（邮箱 + 密码）
邮件验证：关闭（用户注册后直接可用）
邮箱唯一：由 Supabase 自动保证

前端登录/注册：直接调用 supabase.auth.signUp / signInWithPassword
不需要创建 API Route 来处理认证

Session 读取：
  前端组件 → createClient()（@supabase/ssr browser client）
  服务端页面 → createSessionClient()（@supabase/ssr server client with cookies）
  API Route  → createServerClient()（service_role key，绕过 RLS）
```

---

## 四、文件结构规范

```
app/
  api/              ← 所有后端 API Route 放这里
  profile/
  log/
  summary/

components/
  AiSidePanel.tsx   ← 所有页面复用的 AI 助手面板，只有这一个
  layout/
  profile/
  log/
  summary/

lib/
  ai.ts             ← callAI 函数封装，唯一的 AI 调用入口
  prompts.ts        ← 所有 Prompt 集中在这里，不散落在其他文件
  supabase/
    client.ts       ← 前端 Supabase 客户端（用 anon key）
    server.ts       ← 后端 Supabase 客户端（用 service_role key）

types/
  index.ts          ← 所有 TypeScript interface 和 type
```

---

## 五、开发约束（每次必须遵守）

```
1. 每次只做当前 task 文件要求的内容，不多做
2. API 调用只在 /app/api/ 下，组件不直接调用外部 API
3. 所有 Prompt 写在 /lib/prompts.ts，不散落在其他文件
4. 环境变量放 .env.local，绝不硬编码任何 Key
5. 每个 API Route 必须有 try/catch，出错返回友好提示
6. 每个等待操作必须有 loading 状态
7. 新依赖先告知，不擅自 npm install
8. 所有数据结构在 /types/index.ts 定义 interface，不用 any
9. 不做 task 文件里「不做什么」列出的功能
10. AiSidePanel.tsx 是通用组件，三个页面复用同一个，不要重复创建
11. 不要创建 /onboarding 路由或页面
```

---

## 六、AI 调用封装

```typescript
// /lib/ai.ts
import OpenAI from 'openai'

const client = new OpenAI({
  baseURL: 'https://api.deepseek.com',
  apiKey: process.env.DEEPSEEK_API_KEY,
})

export async function callAI(
  messages: { role: 'user' | 'assistant'; content: string }[],
  systemPrompt: string,
  temperature = 0.7
): Promise<string> {
  const response = await client.chat.completions.create({
    model: 'deepseek-chat',
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages,
    ],
    temperature,
  })
  return response.choices[0].message.content ?? ''
}

// 流式输出版本（用于 AI 对话，让用户看到实时生成）
export async function callAIStream(
  messages: { role: 'user' | 'assistant'; content: string }[],
  systemPrompt: string
) {
  return client.chat.completions.create({
    model: 'deepseek-chat',
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages,
    ],
    stream: true,
  })
}
```

---

## 七、Supabase 客户端封装

```typescript
// /lib/supabase/client.ts（前端用，受 RLS 限制）
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// /lib/supabase/server.ts（后端 API Route 用，绕过 RLS）
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export function createServerClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
```

---

## 八、数据库表结构（已在 Supabase 创建）

### user_profiles
```
id uuid (主键，关联 auth.users)
job_title text              职位
industry text               行业
work_years int              工作年限
company_size text           公司规模
job_responsibilities text   工作职责
career_direction text       职业方向
skill_focus text            技能重点（逗号分隔）
onboarding_completed boolean 是否完成初始化
```

### report_nodes（汇报框架，树状结构）
```
id uuid
user_id uuid
name text                   汇报名称（如「周报」）
trigger_desc text           触发时机（如「每周五」）
audience text               汇报对象
modules jsonb               包含模块数组
parent_id uuid              上一层节点（null=顶层）
sort_order int
time_granularity text       'weekly'|'monthly'|'quarterly'|'annual'
```

### dimensions（记录维度，多层级）
```
id uuid
user_id uuid
name text                   维度名称
icon text                   emoji 图标
level int                   层级（1=一级，2=二级，3=最小层级）
parent_id uuid              父节点
sort_order int
prompt_text text            记录提示词（只有 level=3 有值）
```

### daily_logs（日志，核心数据）
```
id uuid
user_id uuid
log_date date               日志日期
dimension_id uuid           对应最小层级维度
content text                用户填写的内容
word_count int              字数
is_ai_generated boolean     是否由 AI 助手填入
```

### summaries（汇报总结）
```
id uuid
user_id uuid
date_from date
date_to date
summary_type text           'weekly'|'monthly'|'quarterly'|'annual'|'adhoc'
title text
content text                Markdown 格式
report_node_id uuid         套用的汇报框架节点
data_sources jsonb          数据来源记录
is_draft boolean
finalized_at timestamptz
```

---

## 九、导航结构（固定，不可更改）

```
左侧边栏导航顺序：
  第一项：职业档案  路由：/profile   图标：◉
  第二项：工作日志  路由：/log       图标：✦
  第三项：汇报总结  路由：/summary   图标：◫
```

职业档案未完善时，导航项旁显示橙色小圆点（#F59E0B）。

---

## 十、AI 助手规范

### 统一入口
- 所有页面右上角统一一个「✦ AI 助手」按钮
- 点击 → 右侧滑出 AiSidePanel 组件（宽 280px）
- 主内容区同步压缩（CSS transition）
- 三个页面共用同一个 AiSidePanel.tsx 组件

### AiSidePanel 结构
```
顶部：✦ AI 助手 标题 | [结束对话] [×]
上下文栏：已读取 xxx 内容（绿色背景）
消息区：AI 气泡（左）+ 用户气泡（右）
底部：输入框 + 发送按钮
```

### 收起方式
- 点 × / 再点「AI 助手」按钮 / 按 Esc → 收起，保留对话历史
- 切换页面 → 自动收起，清空历史

### Tab 切换判断（/profile 内三个 Tab 之间）
- AI 对话为空或已结束 → 直接切，不提示
- 有未采纳预览 → 弹提示「有未采纳内容，切换后将丢失」
- 对话进行中无预览 → 弹提示「对话未结束，切换后将清除」

---

## 十一、新用户 Onboarding 逻辑

**判断条件：** user_profiles.job_title IS NULL 且 report_nodes 无记录

**触发行为：** 进入 /profile 时自动弹出引导弹窗

**弹窗三个入口：**
- 「✦ 和 AI 一起填写」→ 关闭弹窗 + 自动打开 AiSidePanel
- 「我自己来填」→ 关闭弹窗，用户手动填
- 「稍后再说」或 × → 关闭弹窗，本次 session 不再弹

**新用户 AI 开场白：**
「你好！我来帮你建立职业档案，整个过程大概 3–5 分钟。先告诉我——你目前的职位是什么，在哪个行业？」

**老用户 AI 开场白：**
「你好！我已读取你的职业档案。你想调整什么？」

---

*SPEC.md v1.0 | 2026.04.24*
