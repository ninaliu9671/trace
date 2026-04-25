# Task 17 · Summary AI 助手 + AiReplaceCard（局部替换）

> 这是 /summary 模块的最后一个 task，也是整个 MVP 的最后一个 task。
> 完成标准：AI 助手能读取编辑器当前内容，用户指定章节后 AI 返回替换建议卡片，采纳只替换指定段落，复制写入剪贴板，不替换移除卡片，无 TS 报错。

---

## 前置要求

- Task 16 已完成并验收通过
- `/api/summary/ai-chat` 占位版本已在 Task 13 创建
- `AiSidePanel.tsx` 已存在（Task 03）并已多次扩展（Task 08、Task 12）
- `PROMPTS.summary_assistant` 已在 `lib/prompts.ts` 定义（Task 13）

---

## 这次要做什么

### 1. 新增类型

**修改 `/types/index.ts`**，追加替换建议类型，并扩展 `AiMessage`：

```typescript
export interface ReplaceSuggestion {
  type: 'replace_suggestion'
  target_section: string    // 「需求分析第二段」，用于卡片标题
  original: string          // 原文（完整字符串，用于前端 indexOf 匹配）
  replacement: string       // 替换后的内容
}

// 更新 AiMessage（messageType 联合类型新增 'replace_suggestion'）
export interface AiMessage {
  role: 'user' | 'assistant'
  content: string
  messageType?: 'text' | 'onboarding_result' | 'log_preview' | 'replace_suggestion'  // 新增
  onboardingData?: OnboardingResult
  logPreviewData?: LogPreview
  replaceSuggestionData?: ReplaceSuggestion    // 新增
  confirmed?: boolean
}
```

---

### 2. AiReplaceCard 组件

**创建 `components/summary/AiReplaceCard.tsx`**

```typescript
'use client'
import { useState } from 'react'
import { ReplaceSuggestion } from '@/types'

interface AiReplaceCardProps {
  data: ReplaceSuggestion
  onAdopt: (original: string, replacement: string) => void
  onCopy: (replacement: string) => void
  onDismiss: () => void
}

export default function AiReplaceCard({
  data, onAdopt, onCopy, onDismiss,
}: AiReplaceCardProps) {
  const [adopted, setAdopted] = useState(false)
  const [copied, setCopied] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [adoptFailed, setAdoptFailed] = useState(false)  // 原文找不到时提示

  if (dismissed) return null

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(data.replacement)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // 部分浏览器在非 https 下拒绝，降级提示
    }
    onCopy(data.replacement)
  }

  function handleAdopt() {
    const success = onAdopt(data.original, data.replacement) as unknown as boolean
    if (success === false) {
      // 父组件返回 false 说明原文未找到
      setAdoptFailed(true)
    } else {
      setAdopted(true)
    }
  }

  return (
    <div style={{
      background: '#FAFAF8',
      border: '1px solid #E8E4DD',
      borderRadius: 8,
      overflow: 'hidden',
      alignSelf: 'flex-start',
      maxWidth: '92%',
    }}>
      {/* 标题 */}
      <div style={{
        padding: '8px 12px',
        borderBottom: '1px solid #F0EDE8',
        fontSize: 12,
        fontWeight: 500,
        color: '#6B6B6B',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
      }}>
        <span style={{ color: '#1D9E75' }}>✦</span>
        AI 建议替换 · {data.target_section}
      </div>

      <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* 原文（删除线） */}
        <div>
          <div style={{
            fontSize: 10, fontWeight: 500, color: '#B0ADA6',
            letterSpacing: '0.5px', marginBottom: 4,
          }}>
            原文
          </div>
          <div style={{
            fontSize: 12,
            color: '#B0ADA6',
            lineHeight: 1.7,
            textDecoration: 'line-through',
            wordBreak: 'break-all',
          }}>
            {data.original}
          </div>
        </div>

        {/* 替换内容 */}
        <div>
          <div style={{
            fontSize: 10, fontWeight: 500, color: '#0F6E56',
            letterSpacing: '0.5px', marginBottom: 4,
          }}>
            替换为
          </div>
          <div style={{
            fontSize: 12,
            color: '#1A1A1A',
            lineHeight: 1.7,
            wordBreak: 'break-all',
          }}>
            {data.replacement}
          </div>
        </div>

        {/* 原文未找到提示 */}
        {adoptFailed && (
          <div style={{
            fontSize: 11, color: '#B91C1C',
            background: '#FFF0F0', borderRadius: 4, padding: '4px 8px',
          }}>
            原文已被修改，无法自动替换。请手动复制后粘贴。
          </div>
        )}
      </div>

      {/* 操作按钮 */}
      {!adopted && (
        <div style={{
          padding: '8px 12px',
          borderTop: '1px solid #F0EDE8',
          display: 'flex',
          gap: 6,
        }}>
          <button
            onClick={handleAdopt}
            style={{
              flex: 1,
              padding: '5px 0',
              background: '#1D9E75',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: 6,
              fontSize: 12, fontWeight: 500,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            ✓ 采纳替换
          </button>
          <button
            onClick={handleCopy}
            style={{
              padding: '5px 10px',
              background: 'transparent',
              color: copied ? '#1D9E75' : '#6B6B6B',
              border: '1px solid #E8E4DD',
              borderRadius: 6,
              fontSize: 12,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            {copied ? '已复制' : '复制'}
          </button>
          <button
            onClick={() => { setDismissed(true); onDismiss() }}
            style={{
              padding: '5px 10px',
              background: 'transparent',
              color: '#B0ADA6',
              border: '1px solid #E8E4DD',
              borderRadius: 6,
              fontSize: 12,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            不替换
          </button>
        </div>
      )}

      {/* 已采纳状态 */}
      {adopted && (
        <div style={{
          padding: '8px 12px',
          borderTop: '1px solid #F0EDE8',
          fontSize: 12, color: '#9FE1CB',
        }}>
          ✓ 已替换到编辑器
        </div>
      )}
    </div>
  )
}
```

---

### 3. 扩展 AiSidePanel

**修改 `components/AiSidePanel.tsx`**，新增 `replace_suggestion` 消息类型的检测与渲染：

#### 新增 props

```typescript
import { ReplaceSuggestion } from '@/types'

interface AiSidePanelProps {
  // ... 原有 props
  onReplaceSuggestionAdopt?: (original: string, replacement: string) => boolean  // 新增
}
```

#### handleSend 中检测 replaceSuggestion

```typescript
// 在 handleSend 的 try 块内，原有的响应处理链中新增 replace_suggestion 分支：
const data = await res.json()

if (data.replaceSuggestion) {
  setMessages(prev => [...prev, {
    role: 'assistant',
    content: data.content,
    messageType: 'replace_suggestion',
    replaceSuggestionData: data.replaceSuggestion,
  }])
} else if (data.logPreview) {
  // 原有 log_preview 处理（不变）
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

#### 消息列表渲染追加 replace_suggestion 分支

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
        onAdopt={() => onLogPreviewAdopt?.(msg.logPreviewData!.items)}
      />
    )
  }
  if (msg.messageType === 'replace_suggestion' && msg.replaceSuggestionData) {
    return (
      <AiReplaceCard
        key={i}
        data={msg.replaceSuggestionData}
        onAdopt={(original, replacement) => {
          return onReplaceSuggestionAdopt?.(original, replacement) ?? true
        }}
        onCopy={() => {}}   // 复制逻辑在卡片内部处理
        onDismiss={() => {}}
      />
    )
  }
  // 普通气泡（原有，不变）
  return <div key={i} ...>{msg.content}</div>
})}
```

在文件顶部补充 import：

```typescript
import AiReplaceCard from '@/components/summary/AiReplaceCard'
```

---

### 4. SummaryPage：注入 AI 上下文 + 采纳回调

**修改 `app/summary/page.tsx`**：

#### AI 上下文参数

```typescript
// 实时传递编辑器当前内容给 AI（不需要先保存）
const aiExtraParams = selectedSummary
  ? { currentContent: editorContent }
  : { currentContent: '' }
```

#### 采纳回调

```typescript
// 在编辑器内容中替换指定段落（仅替换第一次匹配）
// 返回 false 时表示原文未找到，AiReplaceCard 会显示错误提示
function handleReplaceSuggestionAdopt(original: string, replacement: string): boolean {
  const idx = editorContent.indexOf(original)
  if (idx === -1) return false   // 通知卡片原文未找到

  setEditorContent(prev =>
    prev.slice(0, idx) + replacement + prev.slice(idx + original.length)
  )
  // 切换到编辑模式让用户看到改动（如果当前在预览模式）
  if (editorMode === 'preview') setEditorMode('edit')
  return true
}
```

#### 更新 AiSidePanel props

```typescript
<AiSidePanel
  key={selectedId ?? 'no-selection'}     // 切换总结时重置对话
  isOpen={aiOpen}
  onClose={() => setAiOpen(false)}
  contextLabel={
    selectedSummary
      ? `已读取：${selectedSummary.title ?? formatSummaryTitle(selectedSummary)}（编辑器当前内容）`
      : '请先选择一份总结'
  }
  systemPrompt={PROMPTS.summary_assistant.replace(
    '{current_content}',
    editorContent || '（未选中任何总结）'
  )}
  apiRoute="/api/summary/ai-chat"
  extraBodyParams={aiExtraParams}
  onReplaceSuggestionAdopt={handleReplaceSuggestionAdopt}
/>
```

> `key={selectedId}` 保证切换总结时对话历史自动清空，避免 AI 上下文错位。

---

### 5. 「结束对话」按钮的未采纳提示

`AiSidePanel` 中 `ended` 前的 `hasPendingPreview` 判断，需要把 `replace_suggestion` 也纳入：

```typescript
// 修改 onConversationStateChange 的 hasPendingPreview 计算：
hasPendingPreview: messages.some(
  m => (m.messageType === 'onboarding_result' && !m.confirmed) ||
       (m.messageType === 'replace_suggestion')   // replace_suggestion 始终视为未采纳（卡片存在即未处理）
)
```

> 这样点「结束对话」时，若有未处理的替换建议卡片，会触发「有未采纳内容，结束后将丢失」提示。

---

## 不做什么

```
❌ 整篇重新生成（spec 明确不做）
❌ 多条替换建议同时采纳
❌ 替换历史 / 撤销替换（撤销用「恢复上版」）
❌ 替换建议在预览区内联显示（建议卡片始终在 AI 面板内，不插入正文）
❌ 图片上传（/summary 的 AI 助手不支持图片，见 spec 三节「不做」）
```

---

## 完成标准

```
□ 打开 AI 面板时，绿色横幅显示「已读取：xxx（编辑器当前内容）」
□ 切换到不同总结后，AI 面板对话历史自动清空（key 机制）
□ 用户描述想改哪个章节 → AI 返回 AiReplaceCard（而非普通气泡）
□ AiReplaceCard 显示：「✦ AI 建议替换 · 目标段落名」标题
□ 原文显示为删除线样式
□ 替换内容显示为正常文字
□ 点「✓ 采纳替换」→ 编辑器内容对应段落被替换，卡片显示「✓ 已替换到编辑器」
□ 若当前在预览模式，采纳后自动切到编辑模式（可看到改动）
□ 原文已被修改（indexOf 找不到）→ 卡片显示「原文已被修改，无法自动替换」提示
□ 点「复制」→ replacement 内容写入剪贴板，按钮短暂变为「已复制」
□ 点「不替换」→ 卡片从消息列表消失
□ 有未处理替换卡片时点「结束对话」→ 弹「有未采纳内容，结束后将丢失」提示
□ AI 返回普通聊天文字时（无 replace_suggestion JSON）→ 显示普通气泡
□ 无 TypeScript 报错
□ npm run dev 无报错
```

---

## 做完后告诉我

1. 做了哪些文件
2. AI 能否正确返回 replace_suggestion JSON（还是一直返回普通文字？可检查原始响应）
3. 采纳替换后编辑器内容是否真正改变（对应段落替换了，其他段落没动）
4. 未找到原文时错误提示是否出现

---

*Task 17 | 2026.04.24*
