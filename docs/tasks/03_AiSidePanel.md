# Task 03 · AiSidePanel 通用 AI 对话栏

> 完成本 task 后再开始 task 04。
> 完成标准：/profile 右上角 AI 助手按钮可打开/关闭面板，能收发消息，Esc 收起，切页面清空历史。

---

## 前置要求

- Task 02 已完成并验收通过
- `/lib/ai.ts` 已存在（含 `callAI`）
- `/lib/prompts.ts` 已存在（含 `PROMPTS.profile_new_user` 和 `PROMPTS.profile_existing`）

---

## 这次要做什么

### 1. AiSidePanel 组件

**创建 `components/AiSidePanel.tsx`**

这是全局通用组件，/profile、/log、/summary 都复用，不要为每个页面单独写一个。

Props：

```typescript
interface AiSidePanelProps {
  isOpen: boolean
  onClose: () => void
  contextLabel: string        // 绿色横幅文字，如「已读取：职业画像内容」
  systemPrompt: string        // 传入哪个 Prompt
  apiRoute: string            // 调哪个 API，如 '/api/profile/ai-chat'
  initialMessage?: string     // 面板打开时 AI 自动发的第一句话（可选）
}
```

内部状态：

```typescript
const [messages, setMessages] = useState<AiMessage[]>([])
const [input, setInput] = useState('')
const [sending, setSending] = useState(false)
const [ended, setEnded] = useState(false)   // 「结束对话」后为 true
```

`AiMessage` 类型已在 `/types/index.ts` 定义：`{ role: 'user' | 'assistant', content: string }`

---

#### 面板结构（宽度 280px，从右侧滑出）

```
┌─────────────────────────────┐
│ ✦ AI 助手  [结束对话] [×]  │  ← 顶部标题栏，高度 48px，border-bottom
├─────────────────────────────┤
│ 已读取：xxx                  │  ← 上下文横幅（绿色背景）
├─────────────────────────────┤
│                             │
│  [AI 消息气泡]              │
│              [用户消息气泡] │
│  — 本轮对话已结束 —        │  ← ended 时显示
│                             │  ← 消息区，flex-1，overflow-y-auto
├─────────────────────────────┤
│ [输入框]           [发送]   │  ← 输入区，padding 12px
└─────────────────────────────┘
```

---

#### 面板滑出动画

面板用 `position: fixed`，right 侧，配合主内容区压缩：

```typescript
// 面板本身
<div
  style={{
    position: 'fixed',
    top: 0,
    right: 0,
    width: 280,
    height: '100vh',
    background: '#FFFFFF',
    borderLeft: '1px solid #E8E4DD',
    transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
    transition: 'transform 0.2s ease',
    display: 'flex',
    flexDirection: 'column',
    zIndex: 40,
  }}
>
```

主内容区压缩由父页面处理（传入 `isOpen` 后设 `marginRight: isOpen ? 280 : 0`，同样加 transition）。

---

#### 顶部标题栏

```typescript
<div style={{
  height: 48,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '0 16px',
  borderBottom: '1px solid #F0EDE8',
  flexShrink: 0,
}}>
  <span style={{ fontSize: 13, fontWeight: 500, color: '#1A1A1A' }}>✦ AI 助手</span>
  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
    {/* 结束对话按钮：对话为空时隐藏 */}
    {messages.length > 0 && (
      <button
        onClick={handleEndConversation}
        disabled={ended}
        style={{
          fontSize: 12,
          color: ended ? '#B0ADA6' : '#6B6B6B',
          border: '1px solid #E8E4DD',
          borderRadius: 6,
          padding: '3px 8px',
          background: 'transparent',
          cursor: ended ? 'default' : 'pointer',
        }}
      >
        结束对话
      </button>
    )}
    <button onClick={onClose} style={{ fontSize: 16, color: '#B0ADA6', lineHeight: 1 }}>×</button>
  </div>
</div>
```

---

#### 上下文横幅

```typescript
<div style={{
  padding: '8px 16px',
  background: '#F0FBF7',
  borderBottom: '1px solid #E8F7F2',
  fontSize: 12,
  color: '#0F6E56',
  flexShrink: 0,
}}>
  {contextLabel}
</div>
```

---

#### 消息气泡

AI 消息（左对齐）：
```typescript
<div style={{
  background: '#F8F7F4',
  borderRadius: '0 8px 8px 8px',
  padding: '8px 12px',
  fontSize: 13,
  color: '#1A1A1A',
  lineHeight: 1.7,
  maxWidth: '85%',
  alignSelf: 'flex-start',
}}>
  {message.content}
</div>
```

用户消息（右对齐）：
```typescript
<div style={{
  background: '#1A1A1A',
  color: '#FFFFFF',
  borderRadius: '8px 0 8px 8px',
  padding: '8px 12px',
  fontSize: 13,
  lineHeight: 1.7,
  maxWidth: '85%',
  alignSelf: 'flex-end',
}}>
  {message.content}
</div>
```

消息区容器：
```typescript
<div
  ref={scrollRef}
  style={{
    flex: 1,
    overflowY: 'auto',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  }}
>
  {messages.map((msg, i) => (
    <div key={i} /* 根据 role 选气泡样式 */>
      {msg.content}
    </div>
  ))}

  {/* 结束分隔线 */}
  {ended && (
    <div style={{ textAlign: 'center', fontSize: 12, color: '#B0ADA6', padding: '8px 0' }}>
      — 本轮对话已结束 —
    </div>
  )}
</div>
```

每次 `messages` 变化后自动滚到底部：
```typescript
const scrollRef = useRef<HTMLDivElement>(null)

useEffect(() => {
  if (scrollRef.current) {
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }
}, [messages])
```

---

#### 输入区

```typescript
<div style={{
  padding: 12,
  borderTop: '1px solid #F0EDE8',
  display: 'flex',
  gap: 8,
  flexShrink: 0,
}}>
  <textarea
    value={input}
    onChange={e => setInput(e.target.value)}
    onKeyDown={e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    }}
    placeholder="输入消息..."
    disabled={sending || ended}
    rows={1}
    style={{
      flex: 1,
      resize: 'none',
      border: '1px solid #E8E4DD',
      borderRadius: 7,
      padding: '7px 10px',
      fontSize: 13,
      outline: 'none',
      fontFamily: 'inherit',
      lineHeight: 1.5,
    }}
  />
  <button
    onClick={handleSend}
    disabled={!input.trim() || sending || ended}
    style={{
      width: 60,
      background: input.trim() && !sending && !ended ? '#1D9E75' : '#E8E4DD',
      color: input.trim() && !sending && !ended ? '#FFFFFF' : '#B0ADA6',
      borderRadius: 7,
      border: 'none',
      fontSize: 12,
      fontWeight: 500,
      cursor: input.trim() && !sending && !ended ? 'pointer' : 'default',
      flexShrink: 0,
    }}
  >
    {sending ? '...' : '发送'}
  </button>
</div>
```

---

### 2. 消息发送逻辑

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
      body: JSON.stringify({
        messages: [...messages, userMsg],
        systemPrompt,
      }),
    })
    const data = await res.json()
    setMessages(prev => [...prev, { role: 'assistant', content: data.content }])
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

---

### 3. initialMessage（面板打开时 AI 自动发第一句话）

```typescript
useEffect(() => {
  if (isOpen && initialMessage && messages.length === 0) {
    setMessages([{ role: 'assistant', content: initialMessage }])
  }
}, [isOpen])
```

---

### 4. 结束对话逻辑

```typescript
function handleEndConversation() {
  // task 04 之前暂无「未采纳预览」，直接结束
  setEnded(true)
}
```

Task 04 接入预览卡片后再扩展此函数。

---

### 5. Esc 键收起面板

```typescript
useEffect(() => {
  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape' && isOpen) onClose()
  }
  window.addEventListener('keydown', handleKeyDown)
  return () => window.removeEventListener('keydown', handleKeyDown)
}, [isOpen, onClose])
```

---

### 6. API Route

**创建 `app/api/profile/ai-chat/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { callAI } from '@/lib/ai'
import { AiMessage } from '@/types'

export async function POST(req: NextRequest) {
  try {
    const { messages, systemPrompt }: { messages: AiMessage[]; systemPrompt: string } = await req.json()
    const content = await callAI(messages, systemPrompt)
    return NextResponse.json({ content })
  } catch (error) {
    return NextResponse.json({ error: 'AI 服务暂时不可用，请稍后重试' }, { status: 500 })
  }
}
```

---

### 7. 在 ProfilePage 中接入 AiSidePanel

**修改 `app/profile/page.tsx`**

导入组件，传入 props，主内容区加 `marginRight` 过渡：

```typescript
import AiSidePanel from '@/components/AiSidePanel'
import { PROMPTS } from '@/lib/prompts'

// 在 JSX 中（与 OnboardingModal 同级）：
<AiSidePanel
  isOpen={aiOpen}
  onClose={() => setAiOpen(false)}
  contextLabel="已读取：职业画像内容"        // task 08 再按 Tab 动态切换
  systemPrompt={PROMPTS.profile_new_user}    // task 08 再按新/老用户切换
  apiRoute="/api/profile/ai-chat"
  initialMessage="你好！我来帮你建立职业档案，整个过程大概 3–5 分钟。先告诉我——你目前的职位是什么，在哪个行业？"
/>

// 主内容区加过渡（包裹 Tab 内容的 div）：
<div style={{
  flex: 1,
  marginRight: aiOpen ? 280 : 0,
  transition: 'margin-right 0.2s ease',
  overflow: 'hidden',
}}>
  {/* 原有内容 */}
</div>
```

---

### 8. AI 助手按钮样式

**修改 `app/profile/page.tsx`** 中右上角按钮样式（之前是 console.log 占位，现在接上 `setAiOpen`）：

```typescript
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
```

---

## 不做什么

```
❌ 导航切换时清空历史（Sidebar 需要改造，task 后续处理，现在不做）
❌ 未采纳预览卡片的处理（task 04 引入预览卡片后再扩展）
❌ /log、/summary 页面的 AI 面板接入（后续 task 做）
❌ 流式输出（streaming），直接用 callAI 返回完整结果
❌ Tab 切换时的对话保护弹窗（task 08 做）
```

---

## 完成标准

```
□ 点击「✦ AI 助手」按钮 → 面板从右侧滑出，主内容区同步压缩
□ 再次点击按钮 → 面板收起，历史保留
□ 按 Esc → 面板收起，历史保留
□ 点面板 × → 收起，历史保留
□ 面板顶部绿色横幅显示「已读取：职业画像内容」
□ 发送消息 → 按钮变「...」，AI 回复后消息追加到列表，自动滚到底
□ Enter 发送，Shift+Enter 换行
□ 点「结束对话」→ 出现「— 本轮对话已结束 —」分隔线，按钮变灰禁用
□ 对话为空时「结束对话」按钮不显示
□ AI 助手按钮激活态（面板打开时）变深绿色实心
□ 无 TypeScript 报错
□ npm run dev 无报错
```

---

## 做完后告诉我

1. 做了哪些文件
2. DeepSeek API 调用有没有正常返回（或者 API key 未配置时如何处理）
3. 不要自动开始 task 04，等我验收

---

*Task 03 | 2026.04.24*
