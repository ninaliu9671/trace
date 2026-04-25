# Task 12 · Log AI 助手接入（日志整理 + 图片上传）

> 完成本 task 后 /log 模块全部完成，可以开始 task 13。
> 完成标准：AI 助手能接收用户描述并归类到对应维度，采纳后以浅绿竖线样式填入字段；图片上传后 AI OCR 识别并给出预览卡片。

---

## 前置要求

- Task 11 已完成并验收通过
- `AiSidePanel.tsx` 已存在（含 `onConversationStateChange`、`onOnboardingComplete` 等 props）
- `/api/log/ai-chat` 已存在（Task 09 建的占位版本，本 task 完善）
- `lib/dimensionUtils.ts` 已存在

---

## 这次要做什么

### 1. 新增类型

**修改 `/types/index.ts`**，追加 log_preview 相关类型，并扩展 `AiMessage`：

```typescript
export interface LogPreviewItem {
  dimension_id: string
  dimension_name: string
  content: string
}

export interface LogPreview {
  type: 'log_preview'
  items: LogPreviewItem[]
}

// 更新 AiMessage（在 messageType 联合类型中增加 'log_preview'）
export interface AiMessage {
  role: 'user' | 'assistant'
  content: string
  messageType?: 'text' | 'onboarding_result' | 'log_preview'  // 新增 log_preview
  onboardingData?: OnboardingResult
  logPreviewData?: LogPreview                                   // 新增
  confirmed?: boolean
}
```

---

### 2. 更新 /api/log/ai-chat（完整版）

**修改 `app/api/log/ai-chat/route.ts`**，替换 task 09 的占位版本：

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { callAI } from '@/lib/ai'
import { AiMessage } from '@/types'
import { PROMPTS } from '@/lib/prompts'

export async function POST(req: NextRequest) {
  try {
    const {
      messages,
      dimensionsTree,
      existingLogs,
      image,           // base64 data URL，可选
    }: {
      messages: AiMessage[]
      dimensionsTree: string
      existingLogs: string
      image?: string
    } = await req.json()

    const systemPrompt = PROMPTS.log_assistant
      .replace('{dimensions_tree}', dimensionsTree || '暂无维度数据')
      .replace('{existing_logs}', existingLogs || '今天暂无记录')

    // 构建发给 AI 的消息列表
    // 最后一条用户消息如果带图片，改为多模态格式
    const aiMessages: { role: 'user' | 'assistant'; content: string | unknown[] }[] =
      messages.map((m, i) => {
        const isLast = i === messages.length - 1
        if (isLast && m.role === 'user' && image) {
          return {
            role: 'user' as const,
            content: [
              { type: 'image_url', image_url: { url: image } },
              { type: 'text', text: m.content || '请识别图片中的工作内容，整理到对应维度。' },
            ],
          }
        }
        return { role: m.role, content: m.content }
      })

    const content = await callAI(
      aiMessages as { role: 'user' | 'assistant'; content: string }[],
      systemPrompt
    )

    // 尝试解析 log_preview JSON
    let logPreview = null
    try {
      const parsed = JSON.parse(content)
      if (parsed?.type === 'log_preview') logPreview = parsed
    } catch {
      // 普通对话文字，忽略
    }

    return NextResponse.json({ content, logPreview })
  } catch {
    return NextResponse.json(
      { error: 'AI 服务暂时不可用，请稍后重试' },
      { status: 500 }
    )
  }
}
```

> DeepSeek 的视觉能力通过 `deepseek-chat` 或专用 vision 模型支持，具体以 API 实际响应为准。若收到"不支持多模态"的错误，将图片内容替换为纯文字提示并重试。

---

### 3. 扩展 AiSidePanel

**修改 `components/AiSidePanel.tsx`**，新增两个 props：

```typescript
interface AiSidePanelProps {
  // ... 原有 props
  extraBodyParams?: Record<string, unknown>   // 新增：额外请求体参数
  enableImageUpload?: boolean                  // 新增：是否显示图片上传按钮
  onLogPreviewAdopt?: (items: LogPreviewItem[]) => void  // 新增：采纳预览时回调
}
```

#### handleSend 更新（合并 extraBodyParams）

```typescript
// 在 fetch 的 body 中合并 extraBodyParams：
body: JSON.stringify({
  messages: [...messages, userMsg],
  ...extraBodyParams,    // 新增，spread 进去
})
```

#### 检测 log_preview 响应

```typescript
// 在 handleSend 的 try 块内，替换原有响应处理：
const data = await res.json()

if (data.logPreview) {
  setMessages(prev => [...prev, {
    role: 'assistant',
    content: data.content,
    messageType: 'log_preview',
    logPreviewData: data.logPreview,
  }])
} else if (data.onboardingResult) {
  // 原有 onboarding 处理（不变）
  setMessages(prev => [...prev, {
    role: 'assistant',
    content: data.content,
    messageType: 'onboarding_result',
    onboardingData: data.onboardingResult,
  }])
} else {
  setMessages(prev => [...prev, {
    role: 'assistant',
    content: data.content ?? data.error ?? 'AI 服务暂时不可用，请稍后重试。',
  }])
}
```

#### 消息列表渲染（追加 log_preview 分支）

```typescript
{messages.map((msg, i) => {
  if (msg.messageType === 'onboarding_result' && msg.onboardingData) {
    return <OnboardingPreviewCard key={i} ... />    // 原有，不变
  }
  if (msg.messageType === 'log_preview' && msg.logPreviewData) {
    return (
      <LogPreviewCard
        key={i}
        data={msg.logPreviewData}
        onAdopt={() => {
          onLogPreviewAdopt?.(msg.logPreviewData!.items)
          // 标记该条消息为已采纳（后续可扩展 confirmed 字段）
        }}
      />
    )
  }
  return <div key={i} /* 普通气泡 */ > {msg.content} </div>
})}
```

#### 图片上传 UI（enableImageUpload 为 true 时显示）

新增内部状态：

```typescript
const [pendingImage, setPendingImage] = useState<string | null>(null)  // base64 data URL
const fileInputRef = useRef<HTMLInputElement>(null)
```

图片选择处理：

```typescript
function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
  const file = e.target.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => setPendingImage(reader.result as string)
  reader.readAsDataURL(file)
  e.target.value = ''   // 允许重复选同一文件
}
```

在输入区顶部渲染图片预览（有 pendingImage 时显示）：

```typescript
{enableImageUpload && pendingImage && (
  <div style={{
    padding: '8px 12px 0',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  }}>
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <img
        src={pendingImage}
        alt="待上传"
        style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 4, border: '1px solid #E8E4DD' }}
      />
      <button
        onClick={() => setPendingImage(null)}
        style={{
          position: 'absolute', top: -6, right: -6,
          width: 14, height: 14, borderRadius: '50%',
          background: '#6B6B6B', color: '#FFFFFF',
          border: 'none', cursor: 'pointer',
          fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
          lineHeight: 1,
        }}
      >
        ×
      </button>
    </div>
    <span style={{ fontSize: 11, color: '#B0ADA6' }}>图片将随消息发送给 AI</span>
  </div>
)}
```

输入区按钮行（文本框左侧加图片按钮）：

```typescript
// 在 textarea 和发送按钮之间加图片上传按钮
{enableImageUpload && (
  <>
    <input
      ref={fileInputRef}
      type="file"
      accept="image/*"
      onChange={handleImageSelect}
      style={{ display: 'none' }}
    />
    <button
      onClick={() => fileInputRef.current?.click()}
      disabled={sending || ended}
      title="上传图片"
      style={{
        width: 32, height: 32, flexShrink: 0,
        border: '1px solid #E8E4DD', borderRadius: 7,
        background: pendingImage ? '#E8F7F2' : 'transparent',
        color: pendingImage ? '#1D9E75' : '#B0ADA6',
        cursor: 'pointer', fontSize: 14,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      📷
    </button>
  </>
)}
```

`handleSend` 中加入图片并在发送后清空：

```typescript
async function handleSend() {
  const text = input.trim()
  if (!text && !pendingImage) return   // 图片或文字至少有一个
  if (sending || ended) return

  const userMsg: AiMessage = { role: 'user', content: text || '（图片）' }
  setMessages(prev => [...prev, userMsg])
  setInput('')
  const imageToSend = pendingImage
  setPendingImage(null)                 // 发送后清空图片
  setSending(true)

  try {
    const res = await fetch(apiRoute, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [...messages, userMsg],
        ...(imageToSend ? { image: imageToSend } : {}),
        ...extraBodyParams,
      }),
    })
    // ... 原有响应处理
  }
}
```

---

### 4. LogPreviewCard 组件

**创建 `components/log/LogPreviewCard.tsx`**

```typescript
'use client'
import { useState } from 'react'
import { LogPreview } from '@/types'

interface LogPreviewCardProps {
  data: LogPreview
  onAdopt: () => void
}

export default function LogPreviewCard({ data, onAdopt }: LogPreviewCardProps) {
  const [adopted, setAdopted] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  return (
    <div style={{
      background: '#F0FBF7',
      border: '1px solid #9FE1CB',
      borderRadius: 8,
      overflow: 'hidden',
      alignSelf: 'flex-start',
      maxWidth: '90%',
    }}>
      {/* 标题 */}
      <div style={{
        padding: '8px 12px',
        borderBottom: '1px solid #E8F7F2',
        fontSize: 12,
        fontWeight: 500,
        color: '#0F6E56',
      }}>
        ✦ AI 整理结果 · {data.items.length} 条
      </div>

      {/* 预览条目 */}
      <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {data.items.map((item, i) => (
          <div key={i}>
            {/* 维度标签 */}
            <div style={{
              display: 'inline-block',
              fontSize: 11,
              color: '#0F6E56',
              background: '#DCF5EC',
              borderRadius: 4,
              padding: '1px 6px',
              marginBottom: 4,
            }}>
              {item.dimension_name}
            </div>
            {/* 整理后内容 */}
            <div style={{
              fontSize: 12,
              color: '#1A1A1A',
              lineHeight: 1.7,
            }}>
              {item.content}
            </div>
          </div>
        ))}
      </div>

      {/* 操作按钮 */}
      {!adopted && (
        <div style={{
          padding: '8px 12px',
          borderTop: '1px solid #E8F7F2',
          display: 'flex',
          gap: 8,
        }}>
          <button
            onClick={() => { setAdopted(true); onAdopt() }}
            style={{
              flex: 1,
              padding: '5px 0',
              background: '#1D9E75',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            采纳，填入记录
          </button>
          <button
            onClick={() => setDismissed(true)}
            style={{
              padding: '5px 10px',
              background: 'transparent',
              color: '#B0ADA6',
              border: '1px solid #E8E4DD',
              borderRadius: 6,
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            不采纳
          </button>
        </div>
      )}

      {/* 已采纳状态 */}
      {adopted && (
        <div style={{
          padding: '8px 12px',
          borderTop: '1px solid #E8F7F2',
          fontSize: 12,
          color: '#9FE1CB',
        }}>
          ✓ 已填入记录
        </div>
      )}
    </div>
  )
}
```

---

### 5. LogPage：注入 AI 上下文 + 采纳回调

**修改 `app/log/page.tsx`**

#### 格式化维度树（传给 AI）

```typescript
import { buildDimensionTree } from '@/lib/dimensionUtils'
import { LogPreviewItem } from '@/types'

function formatDimensionsTree(dims: Dimension[]): string {
  const leaves = dims.filter(d => d.level === 3)
  if (leaves.length === 0) return '暂无维度数据'
  return leaves.map(leaf => {
    const parent = dims.find(d => d.id === leaf.parent_id)
    const grandParent = parent ? dims.find(d => d.id === parent.parent_id) : null
    const path = [grandParent?.name, parent?.name, leaf.name].filter(Boolean).join(' > ')
    return `ID:${leaf.id} ${path}${leaf.prompt_text ? `（${leaf.prompt_text}）` : ''}`
  }).join('\n')
}
```

> 在维度路径前加 `ID:xxx` 让 AI 在 JSON 中填入正确的 `dimension_id`。

#### 格式化已有记录（传给 AI）

```typescript
function formatExistingLogs(
  fieldStates: Record<string, LogFieldState>,
  dims: Dimension[]
): string {
  const filled = Object.entries(fieldStates).filter(([, s]) => s.content.trim())
  if (filled.length === 0) return '今天暂无记录'
  return filled.map(([dimId, state]) => {
    const dim = dims.find(d => d.id === dimId)
    return `${dim?.name ?? dimId}：${state.content}`
  }).join('\n')
}
```

#### 采纳回调

```typescript
function handleLogPreviewAdopt(items: LogPreviewItem[]) {
  setFieldStates(prev => {
    const next = { ...prev }
    for (const item of items) {
      next[item.dimension_id] = {
        content: item.content,
        isAiFilled: true,
      }
    }
    return next
  })

  // 滚动到第一个被填入的字段
  const firstId = items[0]?.dimension_id
  if (firstId) {
    setActiveLeafId(firstId)
    setTimeout(() => {
      document.getElementById(`log-field-${firstId}`)?.scrollIntoView({
        behavior: 'smooth', block: 'start',
      })
    }, 100)
  }
}
```

#### 更新 AiSidePanel 的 props

```typescript
// 计算 extraBodyParams（实时反映当前 fieldStates 和 dimensions）
const aiExtraParams = {
  dimensionsTree: formatDimensionsTree(dimensions),
  existingLogs: formatExistingLogs(fieldStates, dimensions),
}

<AiSidePanel
  key={toDateString(currentDate)}         // 切日期时重置对话
  isOpen={aiOpen}
  onClose={() => setAiOpen(false)}
  contextLabel={`已读取：${toDateString(currentDate)} 的工作记录`}
  systemPrompt={PROMPTS.log_assistant
    .replace('{dimensions_tree}', aiExtraParams.dimensionsTree)
    .replace('{existing_logs}', aiExtraParams.existingLogs)}
  apiRoute="/api/log/ai-chat"
  extraBodyParams={aiExtraParams}
  enableImageUpload={true}
  onLogPreviewAdopt={handleLogPreviewAdopt}
/>
```

> `extraBodyParams` 是每次渲染时重新计算的，但 AiSidePanel 在 handleSend 时读取的是调用时刻的值（通过闭包），因此始终是最新的 fieldStates。

---

## 不做什么

```
❌ 流式输出（统一用非流式，一次返回完整响应）
❌ 图片 OCR 的本地实现（依赖 DeepSeek 多模态能力，无需额外 OCR 库）
❌ 图片存储到 Supabase Storage（图片仅用于当次 AI 识别，不持久化）
❌ 多张图片同时上传（每次只支持一张）
❌ /summary 的 AI 替换建议（Task 17 做）
❌ Tab 切换保护弹窗（/log 只有一个视图，无需切换保护）
```

---

## 完成标准

```
□ 打开 AI 面板时，绿色横幅显示「已读取：YYYY-MM-DD 的工作记录」
□ 输入区左侧有 📷 图片上传按钮
□ 点 📷 → 文件选择器弹出，只接受图片类型
□ 选图后：输入区上方出现 36×36 缩略图 + ×删除按钮
□ 点 × → 缩略图消失
□ 发送文字消息 → AI 返回 log_preview 卡片（含维度标签 + 整理内容）
□ 卡片底部有「采纳，填入记录」「不采纳」两个按钮
□ 点「采纳」→ 对应维度字段填入内容，显示浅绿竖线（isAiFilled 样式）
□ 采纳后右栏自动滚到被填入的第一个字段
□ 采纳后卡片显示「✓ 已填入记录」，按钮消失
□ 点「不采纳」→ 卡片消失
□ 目录圆点实时更新（采纳后该维度圆点变绿）
□ 切换日期 → AI 面板重置（对话清空），上下文自动切换到新日期
□ 含图片的消息发送后，图片缩略图从输入区消失
□ DeepSeek 不支持多模态时：API 返回友好错误消息（不崩溃）
□ 无 TypeScript 报错
□ npm run dev 无报错
```

---

## 做完后告诉我

1. 做了哪些文件
2. AI 归类是否准确（维度 ID 是否正确匹配到对应字段）
3. 图片上传后 AI 能否识别内容（或明确说明 DeepSeek 是否支持多模态）
4. 不要自动开始 task 13，等我验收

---

*Task 12 | 2026.04.24*
