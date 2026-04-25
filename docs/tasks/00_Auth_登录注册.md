# Task 00 · 登录 / 注册页面 + 认证逻辑

> 这是第一个要做的 task，做完再做 Task 01。
> 完成标准：用户能注册、能登录、登录后跳转 /profile、未登录访问其他页面跳回 /login。

\---

## 前置操作（你来做，不是 Claude Code 做）

在 Supabase 控制台关掉邮件验证：

```
supabase.com → 你的项目
→ Authentication → Providers → Email
→ 把「Confirm email」关掉
→ Save
```

\---

## 这次要做什么

### 1\. 登录/注册页面

**创建 `app/login/page.tsx`**

页面设计要求：

* 整页背景 #F8F7F4
* 居中卡片，宽度 380px，背景白色，圆角 12px，border 1px solid #E8E4DD
* 顶部 Logo：「Trace」黑色 + 「履迹」绿色（#1D9E75），居中，20px/500
* Logo 下方副标题：「随手记录工作，AI 帮你整理成汇报总结」，13px，#6B6B6B，居中，margin-bottom 20px
* 两个 Tab 切换：「登录」和「注册」，Tab 激活态绿色下划线 #1D9E75
* 输入框样式参考 DESIGN.md（border #E8E4DD，focus border #1D9E75，圆角 7px）
* 主按钮：绿色 #1D9E75，白色文字，全宽，圆角 8px，13px/500
* 错误提示：12px，#D94F4F，显示在按钮上方
* 底部：「登录即代表你同意我们的服务条款」，11px，#B0ADA6，居中，margin-top 16px

页面布局：

```
整页居中
┌─────────────────────────────────┐
│          Trace 履迹             │
│    随手记录工作，AI 帮你整理     │
│                                 │
│  ┌───────────────────────────┐  │
│  │  \\\[登录]        \\\[注册]     │  │
│  ├───────────────────────────┤  │
│  │  邮箱                     │  │
│  │  \\\[输入框]                 │  │
│  │  密码                     │  │
│  │  \\\[输入框]                 │  │
│  │  （注册时额外显示确认密码） │  │
│  │                           │  │
│  │  错误提示（有错误时显示）  │  │
│  │                           │  │
│  │  \\\[登录 / 注册]（主按钮）  │  │
│  └───────────────────────────┘  │
│    登录即代表你同意我们的服务条款 │
└─────────────────────────────────┘
```

注册和登录区别：

* 注册 Tab：邮箱 + 密码 + 确认密码（三个输入框）
* 登录 Tab：邮箱 + 密码（两个输入框）

错误提示文案：

```
注册时：
  邮箱已被注册  → 「该邮箱已注册，请直接登录或使用其他邮箱」
  密码不一致    → 「两次输入的密码不一致」
  密码少于6位   → 「密码至少需要 6 位」
  其他          → 「注册失败，请稍后重试」

登录时：
  邮箱或密码错  → 「邮箱或密码错误，请重新输入」
  用户不存在    → 「该邮箱尚未注册，请先注册」
  其他          → 「登录失败，请稍后重试」
```

交互逻辑：

* 点击主按钮时：按钮禁用，文字改为「处理中...」
* 登录成功 → 跳转 /profile
* 注册成功（自动登录）→ 跳转 /profile
* 失败 → 显示错误文字，按钮恢复

\---

### 2\. Supabase Auth 调用方式

登录和注册直接在前端组件调用，不需要创建 API Route：

```typescript
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()

// 注册（Supabase 自动处理邮箱唯一性）
const { data, error } = await supabase.auth.signUp({ email, password })

// 登录
const { data, error } = await supabase.auth.signInWithPassword({ email, password })
```

错误码判断：

```
error.message 包含 'already registered' → 邮箱已注册
error.message 包含 'Invalid login'      → 邮箱或密码错误
error.message 包含 'not found'          → 用户不存在
```

\---

### 3\. 修改根路由

**修改 `app/page.tsx`**：

* 服务端检查当前用户 session
* 有 session → redirect('/profile')
* 无 session → redirect('/login')

使用 @supabase/ssr 的服务端 cookies 方式读取 session，Claude Code 自行选择正确实现。

\---

### 4\. 中间件保护路由

**创建 `middleware.ts`**（放在项目根目录，和 app/ 同级）

作用：未登录用户访问受保护路由时自动跳转 /login

受保护路由：

```
/profile 及其子路由
/log 及其子路由
/summary 及其子路由
```

使用 @supabase/ssr 的 middleware 写法，Claude Code 自行处理具体实现细节。

\---

### 5\. 更新 Supabase Server Client

更新 `/lib/supabase/server.ts`，同时提供两个函数：

```typescript
// 函数一：读取当前用户 session（page.tsx 和 middleware 里用）
// 使用 @supabase/ssr + cookies
export function createSessionClient(...) { ... }

// 函数二：服务端数据操作，绕过 RLS（api/route.ts 里用）
// 使用 service\\\_role key
export function createServerClient() { ... }
```

\---

## 不做什么

```
❌ 邮件验证（已在 Supabase 控制台关掉）
❌ 忘记密码功能
❌ 第三方登录
❌ 用户头像或资料编辑
❌ /profile 等其他页面的任何内容
```

\---

## 完成标准

```
□ localhost:3000 → 自动跳转 /login
□ /login 页面样式符合 DESIGN.md
□ 注册：新邮箱 + 密码 + 确认密码 → 注册成功 → 跳 /profile
□ 注册：已存在邮箱 → 提示「该邮箱已注册」
□ 注册：密码不一致 → 提示「两次密码不一致」
□ 登录：正确邮箱密码 → 跳 /profile
□ 登录：错误密码 → 提示错误，不跳转
□ 未登录直接访问 /profile → 跳回 /login
□ 已登录访问 /login → 跳转 /profile（可选，后续再做）
□ 无 TypeScript 报错
```

\---

## 做完后告诉我

1. 做了哪些文件
2. middleware 有没有正常工作
3. 不要自动开始 Task 01，等我验收

\---

*Task 00 | 2026.04.24*

