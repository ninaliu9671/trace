# Task 02 · OnboardingModal + 新用户判断逻辑

> 完成本 task 后再开始 task 03。
> 完成标准：新用户进入 /profile 自动弹出引导弹窗，三个入口行为正确，老用户不弹。

---

## 前置要求

- Task 01 已完成并验收通过
- `/app/profile/page.tsx` 已存在（含 `aiOpen` state）
- Supabase 已有 `user_profiles`、`report_nodes`、`dimensions` 三张表

---

## 这次要做什么

### 1. 新用户判断逻辑

**修改 `app/profile/page.tsx`**，在页面加载时检查当前用户是否为新用户：

判断条件（三个都满足才是新用户）：
```
user_profiles.job_title IS NULL
AND report_nodes 表中该用户无记录
AND dimensions 表中该用户无记录
```

实现方式：在 `useEffect` 里用 Supabase client 并发查三张表：

```typescript
import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'

// 在 ProfilePage 组件内：
const [showOnboarding, setShowOnboarding] = useState(false)
const [checkingUser, setCheckingUser] = useState(true)

useEffect(() => {
  async function checkNewUser() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const [profileRes, nodesRes, dimsRes] = await Promise.all([
      supabase.from('user_profiles').select('job_title').eq('id', user.id).single(),
      supabase.from('report_nodes').select('id').eq('user_id', user.id).limit(1),
      supabase.from('dimensions').select('id').eq('user_id', user.id).limit(1),
    ])

    const isNew =
      !profileRes.data?.job_title &&
      (nodesRes.data?.length ?? 0) === 0 &&
      (dimsRes.data?.length ?? 0) === 0

    setShowOnboarding(isNew)
    setCheckingUser(false)
  }
  checkNewUser()
}, [])
```

`checkingUser` 为 `true` 时不渲染弹窗（避免闪烁）。

---

### 2. OnboardingModal 组件

**创建 `components/profile/OnboardingModal.tsx`**

Props：
```typescript
interface OnboardingModalProps {
  onWithAI: () => void       // 「和 AI 一起填写」
  onSelf: () => void         // 「我自己来填」
  onDismiss: () => void      // 「稍后再说」或 ×
}
```

样式要求：
- 遮罩：`fixed inset-0`，背景 `rgba(0,0,0,0.3)`，`backdrop-blur-sm`，`z-50`
- 弹窗卡片：宽度 420px，居中（`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2`），背景白色，圆角 12px，border `1px solid #E8E4DD`，padding 32px

弹窗内容结构：

```
┌─────────────────────────────────────────┐
│                                     [×] │  ← 右上角，16px，#B0ADA6
│  👋                                     │  ← 24px，mb-3
│  欢迎使用 Trace 履迹                     │  ← 18px/500，#1A1A1A
│                                         │
│  在开始记录之前，先花 3 分钟              │  ← 13px，#6B6B6B，行高1.7
│  建立你的职业档案。AI 会根据你的情况，    │
│  设计一套专属的记录框架。                │
│                                         │
│  ① 告诉 AI 你的职业背景                 │  ← 13px，#1A1A1A，mb-1
│  ② AI 帮你设计汇报框架                  │
│  ③ 确认后开始每日记录                   │
│                                         │
│  [✦ 和 AI 一起填写]                     │  ← 绿色按钮，全宽
│  [我自己来填]                           │  ← 灰色边框按钮，全宽，mt-2
│  稍后再说                               │  ← 文字链接，居中，mt-3
└─────────────────────────────────────────┘
```

按钮样式：
```
绿色主按钮：background #1D9E75，文字白色，全宽，height 40px，圆角 8px，13px/500
灰色次按钮：background transparent，border 1px solid #E8E4DD，文字 #6B6B6B，全宽，height 40px，圆角 8px，13px/500
文字链接：  12px，#B0ADA6，cursor-pointer，hover: #6B6B6B
```

三步引导列表（用带序号的 span，不用 ul/li）：
```typescript
const steps = [
  '告诉 AI 你的职业背景',
  'AI 帮你设计汇报框架',
  '确认后开始每日记录',
]
```

完整组件实现：

```typescript
'use client'

interface OnboardingModalProps {
  onWithAI: () => void
  onSelf: () => void
  onDismiss: () => void
}

export default function OnboardingModal({ onWithAI, onSelf, onDismiss }: OnboardingModalProps) {
  return (
    <div className="fixed inset-0 z-50" style={{ backgroundColor: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(2px)' }}>
      <div
        className="absolute"
        style={{
          width: 420,
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: '#FFFFFF',
          borderRadius: 12,
          border: '1px solid #E8E4DD',
          padding: 32,
        }}
      >
        {/* × 关闭 */}
        <button
          onClick={onDismiss}
          style={{ position: 'absolute', top: 16, right: 16, color: '#B0ADA6', fontSize: 16, lineHeight: 1 }}
        >
          ×
        </button>

        {/* 内容 */}
        <div style={{ fontSize: 24, marginBottom: 12 }}>👋</div>
        <h2 style={{ fontSize: 18, fontWeight: 500, color: '#1A1A1A', marginBottom: 12 }}>
          欢迎使用 Trace 履迹
        </h2>
        <p style={{ fontSize: 13, color: '#6B6B6B', lineHeight: 1.7, marginBottom: 20 }}>
          在开始记录之前，先花 3 分钟建立你的职业档案。<br />
          AI 会根据你的情况，设计一套专属的记录框架。
        </p>

        {/* 三步引导 */}
        <div style={{ marginBottom: 24 }}>
          {['告诉 AI 你的职业背景', 'AI 帮你设计汇报框架', '确认后开始每日记录'].map((step, i) => (
            <div key={i} style={{ fontSize: 13, color: '#1A1A1A', marginBottom: 6 }}>
              <span style={{ color: '#B0ADA6', marginRight: 8 }}>{'①②③'[i]}</span>
              {step}
            </div>
          ))}
        </div>

        {/* 按钮组 */}
        <button
          onClick={onWithAI}
          style={{
            width: '100%', height: 40, background: '#1D9E75', color: '#FFFFFF',
            borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 500, cursor: 'pointer', marginBottom: 8,
          }}
        >
          ✦ 和 AI 一起填写
        </button>
        <button
          onClick={onSelf}
          style={{
            width: '100%', height: 40, background: 'transparent', color: '#6B6B6B',
            borderRadius: 8, border: '1px solid #E8E4DD', fontSize: 13, cursor: 'pointer', marginBottom: 12,
          }}
        >
          我自己来填
        </button>
        <div style={{ textAlign: 'center' }}>
          <span
            onClick={onDismiss}
            style={{ fontSize: 12, color: '#B0ADA6', cursor: 'pointer' }}
          >
            稍后再说
          </span>
        </div>
      </div>
    </div>
  )
}
```

---

### 3. 在 ProfilePage 中接入 OnboardingModal

**修改 `app/profile/page.tsx`**：

```typescript
import OnboardingModal from '@/components/profile/OnboardingModal'

// 在 JSX 里，放在最外层 div 的末尾：
{!checkingUser && showOnboarding && (
  <OnboardingModal
    onWithAI={() => {
      setShowOnboarding(false)
      setAiOpen(true)         // 打开 AI 面板（task 03 实现，现在 console.log 占位）
    }}
    onSelf={() => setShowOnboarding(false)}
    onDismiss={() => setShowOnboarding(false)}
  />
)}
```

`setAiOpen(true)` 已在 task 01 中定义，task 03 实现 AI 面板时会接上。

---

### 4. Session 内不再弹出（稍后再说）

「稍后再说」和 × 关闭后，本次 session 不再弹出。用 `sessionStorage` 实现：

```typescript
// onDismiss 调用时：
const handleDismiss = () => {
  sessionStorage.setItem('onboarding_dismissed', '1')
  setShowOnboarding(false)
}

// checkNewUser 里加一条判断：
if (sessionStorage.getItem('onboarding_dismissed')) {
  setCheckingUser(false)
  return
}
```

将 `handleDismiss` 传给 `onDismiss` prop。

---

## 不做什么

```
❌ AI 面板的具体实现（task 03 做）
❌ AI 对话和数据写入（task 04 做）
❌ 弹窗里真正的"已完成"状态（task 04 数据写入后自动判断）
❌ /log 或 /summary 页面
❌ 登录/登出逻辑
```

---

## 完成标准

```
□ 新用户（三表均空）进入 /profile → 自动弹出引导弹窗
□ 老用户（有数据）进入 /profile → 不弹弹窗
□ 点「✦ 和 AI 一起填写」→ 弹窗关闭，控制台有 AI 面板打开的 log
□ 点「我自己来填」→ 弹窗关闭，页面正常展示
□ 点「稍后再说」或 × → 弹窗关闭，刷新页面不再弹（session 内）
□ 弹窗样式：420px 居中，有 blur 遮罩，三步引导正确显示
□ checkingUser 期间不出现弹窗闪烁
□ 无 TypeScript 报错
□ npm run dev 无报错
```

---

## 做完后告诉我

1. 做了哪些文件
2. 新用户判断逻辑有没有正常工作（可以手动清空数据库记录测试）
3. 不要自动开始 task 03，等我验收

---

*Task 02 | 2026.04.24*
