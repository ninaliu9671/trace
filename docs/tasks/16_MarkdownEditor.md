# Task 16 · MarkdownEditor + SummaryTopbar（操作栏）

> 完成本 task 后再开始 task 17。
> 完成标准：编辑/预览模式可切换，预览中特殊注释正确渲染为彩色块，操作栏各按钮行为正确（恢复上版弹窗 / 存为定稿锁定 / 重新编辑解锁），无 TS 报错。

---

## 前置要求

- Task 15 已完成并验收通过
- `react-markdown` 尚未安装，本 task 需要安装
- `summaries` 表已存在

---

## 新依赖

```bash
npm install react-markdown
```

> `react-markdown` 用于预览模式的 Markdown 渲染。不引入 `rehype-raw`，改用预处理方式处理特殊注释（见下文）。

---

## 这次要做什么

### 1. API Route：POST /api/summary/[id]/update

**创建 `app/api/summary/[id]/update/route.ts`**

保存草稿内容（切换到预览时静默调用）：

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createSessionClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const cookieStore = cookies()
    const sessionClient = createSessionClient(cookieStore)
    const { data: { user } } = await sessionClient.auth.getUser()
    if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })

    const { content }: { content: string } = await req.json()

    const serverClient = createServerClient()

    // 确认这条总结属于当前用户且仍为草稿
    const { data: existing } = await serverClient
      .from('summaries')
      .select('id, is_draft, user_id')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single()

    if (!existing) return NextResponse.json({ error: '总结不存在' }, { status: 404 })
    if (!existing.is_draft) return NextResponse.json({ error: '定稿后不可修改' }, { status: 403 })

    const { error } = await serverClient
      .from('summaries')
      .update({ content, updated_at: new Date().toISOString() })
      .eq('id', params.id)

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: '保存失败，请稍后重试' }, { status: 500 })
  }
}
```

---

### 2. API Route：POST /api/summary/[id]/finalize

**创建 `app/api/summary/[id]/finalize/route.ts`**

存为定稿（锁定文档）：

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createSessionClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const cookieStore = cookies()
    const sessionClient = createSessionClient(cookieStore)
    const { data: { user } } = await sessionClient.auth.getUser()
    if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })

    const serverClient = createServerClient()

    const { error } = await serverClient
      .from('summaries')
      .update({
        is_draft: false,
        finalized_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.id)
      .eq('user_id', user.id)

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: '定稿失败，请稍后重试' }, { status: 500 })
  }
}
```

---

### 3. API Route：POST /api/summary/[id]/re-edit

**创建 `app/api/summary/[id]/re-edit/route.ts`**

「重新编辑」——将定稿改回草稿状态：

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createSessionClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const cookieStore = cookies()
    const sessionClient = createSessionClient(cookieStore)
    const { data: { user } } = await sessionClient.auth.getUser()
    if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })

    const serverClient = createServerClient()

    const { error } = await serverClient
      .from('summaries')
      .update({
        is_draft: true,
        finalized_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.id)
      .eq('user_id', user.id)

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: '操作失败，请稍后重试' }, { status: 500 })
  }
}
```

---

### 4. RevertConfirm 组件

**创建 `components/summary/RevertConfirm.tsx`**

```typescript
interface RevertConfirmProps {
  onConfirm: () => void
  onCancel: () => void
}

export default function RevertConfirm({ onConfirm, onCancel }: RevertConfirmProps) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 60,
      background: 'rgba(0,0,0,0.2)',
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
          恢复到上一个保存版本？当前未保存的修改将丢失。
        </p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{
              fontSize: 13, color: '#6B6B6B',
              border: '1px solid #E8E4DD', borderRadius: 7,
              padding: '6px 16px', background: 'transparent', cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            style={{
              fontSize: 13, color: '#FFFFFF',
              border: 'none', borderRadius: 7,
              padding: '6px 16px',
              background: '#D94F4F',
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            确认恢复
          </button>
        </div>
      </div>
    </div>
  )
}
```

---

### 5. MarkdownEditor 组件

**创建 `components/summary/MarkdownEditor.tsx`**

编辑/预览两种模式，预览模式中用预处理方式渲染特殊注释：

```typescript
'use client'
import ReactMarkdown from 'react-markdown'

interface MarkdownEditorProps {
  content: string
  onChange: (value: string) => void
  mode: 'edit' | 'preview'
  locked: boolean                    // 定稿后为 true，整体 readonly
  onSwitchToEdit?: () => void        // 点击 placeholder 块时切换到编辑模式
}

export default function MarkdownEditor({
  content, onChange, mode, locked, onSwitchToEdit,
}: MarkdownEditorProps) {
  if (mode === 'edit') {
    return (
      <textarea
        value={content}
        onChange={e => onChange(e.target.value)}
        readOnly={locked}
        style={{
          width: '100%',
          height: '100%',
          minHeight: 480,
          padding: '24px',
          fontSize: 13,
          fontFamily: '"JetBrains Mono", "Courier New", monospace',
          lineHeight: 1.8,
          color: '#1A1A1A',
          background: locked ? '#F8F7F4' : '#FFFFFF',
          border: 'none',
          outline: 'none',
          resize: 'none',
          boxSizing: 'border-box',
        }}
      />
    )
  }

  // 预览模式：预处理特殊注释
  return (
    <div style={{
      padding: '24px',
      fontSize: 14,
      lineHeight: 1.8,
      color: '#1A1A1A',
      maxWidth: 720,
    }}>
      <MarkdownPreview
        content={content}
        onPlaceholderClick={onSwitchToEdit}
      />
    </div>
  )
}

// 将 Markdown 文本按特殊注释拆分，分段渲染
function MarkdownPreview({
  content,
  onPlaceholderClick,
}: {
  content: string
  onPlaceholderClick?: () => void
}) {
  // 匹配 <!-- ai-guess: ... --> 和 <!-- placeholder: ... -->
  const segments = splitAnnotations(content)

  return (
    <>
      {segments.map((seg, i) => {
        if (seg.type === 'ai-guess') {
          return (
            <div key={i} style={{
              borderLeft: '2.5px solid #F59E0B',
              background: '#FFFBEB',
              padding: '8px 14px',
              margin: '12px 0',
              borderRadius: '0 6px 6px 0',
              fontSize: 13,
              color: '#92400E',
              lineHeight: 1.7,
            }}>
              <span style={{ fontWeight: 500 }}>✦ AI 推测 · </span>
              {seg.text}
            </div>
          )
        }

        if (seg.type === 'placeholder') {
          return (
            <div
              key={i}
              onClick={onPlaceholderClick}
              style={{
                borderLeft: '2.5px solid #F87171',
                background: '#FFF0F0',
                padding: '8px 14px',
                margin: '12px 0',
                borderRadius: '0 6px 6px 0',
                fontSize: 13,
                color: '#B91C1C',
                lineHeight: 1.7,
                cursor: onPlaceholderClick ? 'pointer' : 'default',
              }}
            >
              <span style={{ fontWeight: 500 }}>⚠ 请补充：</span>
              {seg.text}
            </div>
          )
        }

        // 普通 Markdown 段落
        return (
          <div key={i} className="markdown-body">
            <ReactMarkdown>{seg.text}</ReactMarkdown>
          </div>
        )
      })}

      {/* Markdown 基础样式 */}
      <style>{`
        .markdown-body h1 { font-size: 20px; font-weight: 600; margin: 24px 0 12px; color: #1A1A1A; }
        .markdown-body h2 { font-size: 17px; font-weight: 600; margin: 20px 0 10px; color: #1A1A1A; border-bottom: 1px solid #F0EDE8; padding-bottom: 6px; }
        .markdown-body h3 { font-size: 14px; font-weight: 600; margin: 16px 0 8px; color: #1A1A1A; }
        .markdown-body p  { margin: 8px 0; color: #1A1A1A; }
        .markdown-body ul, .markdown-body ol { padding-left: 20px; margin: 8px 0; }
        .markdown-body li { margin: 4px 0; }
        .markdown-body strong { font-weight: 600; }
        .markdown-body blockquote { border-left: 3px solid #E8E4DD; padding-left: 12px; color: #6B6B6B; margin: 12px 0; }
        .markdown-body code { font-family: "JetBrains Mono", monospace; font-size: 12px; background: #F4F3F0; padding: 1px 4px; border-radius: 3px; }
        .markdown-body pre { background: #F4F3F0; padding: 12px; border-radius: 6px; overflow-x: auto; }
        .markdown-body pre code { background: none; padding: 0; }
        .markdown-body hr { border: none; border-top: 1px solid #F0EDE8; margin: 20px 0; }
      `}</style>
    </>
  )
}

// 将内容拆分为普通文字段 + 注释段
type Segment =
  | { type: 'text'; text: string }
  | { type: 'ai-guess'; text: string }
  | { type: 'placeholder'; text: string }

function splitAnnotations(content: string): Segment[] {
  const pattern = /<!--\s*(ai-guess|placeholder):\s*([\s\S]*?)\s*-->/g
  const segments: Segment[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = pattern.exec(content)) !== null) {
    // 注释前的普通文字
    if (match.index > lastIndex) {
      const text = content.slice(lastIndex, match.index).trim()
      if (text) segments.push({ type: 'text', text })
    }
    segments.push({ type: match[1] as 'ai-guess' | 'placeholder', text: match[2].trim() })
    lastIndex = match.index + match[0].length
  }

  // 最后一段普通文字
  const tail = content.slice(lastIndex).trim()
  if (tail) segments.push({ type: 'text', text: tail })

  return segments
}
```

---

### 6. SummaryTopbar 组件

**创建 `components/summary/SummaryTopbar.tsx`**

```typescript
'use client'
import { useState } from 'react'
import { Summary } from '@/types'
import RevertConfirm from './RevertConfirm'

interface SummaryTopbarProps {
  summary: Summary
  content: string                      // 当前编辑器内容
  initialContent: string               // 加载时的 DB 内容（恢复用）
  mode: 'edit' | 'preview'
  saving: boolean                      // 切换预览时的保存中状态
  onModeChange: (mode: 'edit' | 'preview') => void
  onRevert: () => void                 // 确认恢复后执行
  onFinalize: () => void
  onReEdit: () => void
  aiOpen: boolean
  onAiToggle: () => void
}

const TYPE_LABELS: Record<string, string> = {
  weekly: '周报', monthly: '月报', quarterly: '季报',
  annual: '年报/述职', adhoc: '临时汇报',
}

export default function SummaryTopbar({
  summary, content, initialContent, mode, saving,
  onModeChange, onRevert, onFinalize, onReEdit, aiOpen, onAiToggle,
}: SummaryTopbarProps) {
  const [showRevert, setShowRevert] = useState(false)
  const [finalizing, setFinalizing] = useState(false)
  const [reEditing, setReEditing] = useState(false)

  const hasUnsavedChanges = content !== initialContent
  const isFinalized = !summary.is_draft

  async function handleFinalize() {
    setFinalizing(true)
    await onFinalize()
    setFinalizing(false)
  }

  async function handleReEdit() {
    setReEditing(true)
    await onReEdit()
    setReEditing(false)
  }

  return (
    <>
      <div style={{
        height: 56,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        borderBottom: '1px solid #F0EDE8',
        flexShrink: 0,
        background: '#F8F7F4',
        gap: 12,
      }}>
        {/* 左侧：标题 + meta 标签 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
          <span style={{
            fontSize: 15, fontWeight: 500, color: '#1A1A1A',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {summary.title ?? `${formatShortMonth(summary.date_from)}${TYPE_LABELS[summary.summary_type] ?? '总结'}`}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
            <MetaTag label={TYPE_LABELS[summary.summary_type] ?? '总结'} />
            <MetaTag label={`${summary.date_from} 至 ${summary.date_to}`} />
            {isFinalized ? (
              <span style={{
                fontSize: 10, padding: '1px 5px', borderRadius: 3,
                background: '#F0FBF7', color: '#0F6E56',
                border: '1px solid #9FE1CB',
              }}>定稿</span>
            ) : (
              <span style={{
                fontSize: 10, padding: '1px 5px', borderRadius: 3,
                background: '#FFFBEB', color: '#92400E',
                border: '1px solid #FDE68A',
              }}>草稿</span>
            )}
            {saving && (
              <span style={{ fontSize: 11, color: '#B0ADA6' }}>保存中...</span>
            )}
          </div>
        </div>

        {/* 右侧：操作按钮 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {/* ↩ 恢复上版（仅草稿 + 有修改时显示） */}
          {!isFinalized && hasUnsavedChanges && (
            <button
              onClick={() => setShowRevert(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '5px 10px',
                border: '1px solid #E8E4DD', borderRadius: 7,
                background: 'transparent', color: '#6B6B6B',
                fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              ↩ 恢复上版
            </button>
          )}

          {/* 编辑 | 预览 切换按钮组（定稿后隐藏编辑按钮） */}
          {!isFinalized && (
            <div style={{
              display: 'flex',
              border: '1px solid #E8E4DD',
              borderRadius: 7,
              overflow: 'hidden',
            }}>
              <ModeBtn
                label="编辑"
                active={mode === 'edit'}
                onClick={() => onModeChange('edit')}
              />
              <ModeBtn
                label="预览"
                active={mode === 'preview'}
                onClick={() => onModeChange('preview')}
                borderLeft
              />
            </div>
          )}
          {isFinalized && (
            <div style={{
              display: 'flex',
              border: '1px solid #E8E4DD',
              borderRadius: 7,
              overflow: 'hidden',
            }}>
              <ModeBtn
                label="预览"
                active={true}
                onClick={() => {}}
              />
            </div>
          )}

          {/* ✦ AI 助手 */}
          <button
            onClick={onAiToggle}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '5px 10px',
              background: aiOpen ? '#1D9E75' : '#E8F7F2',
              color: aiOpen ? '#FFFFFF' : '#0F6E56',
              border: `1px solid ${aiOpen ? '#1D9E75' : '#9FE1CB'}`,
              borderRadius: 7, fontSize: 12, fontWeight: 500,
              cursor: 'pointer', transition: 'all 0.15s ease',
              fontFamily: 'inherit',
            }}
          >
            ✦ AI 助手
          </button>

          {/* 存为定稿 / 重新编辑 */}
          {!isFinalized ? (
            <button
              onClick={handleFinalize}
              disabled={finalizing}
              style={{
                padding: '5px 12px',
                border: 'none', borderRadius: 7,
                background: finalizing ? '#6B6B6B' : '#1A1A1A',
                color: '#FFFFFF', fontSize: 12, fontWeight: 500,
                cursor: finalizing ? 'default' : 'pointer',
                fontFamily: 'inherit',
                transition: 'background 0.15s ease',
              }}
            >
              {finalizing ? '定稿中...' : '存为定稿'}
            </button>
          ) : (
            <button
              onClick={handleReEdit}
              disabled={reEditing}
              style={{
                padding: '5px 12px',
                border: '1px solid #E8E4DD', borderRadius: 7,
                background: 'transparent',
                color: reEditing ? '#B0ADA6' : '#6B6B6B',
                fontSize: 12, cursor: reEditing ? 'default' : 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {reEditing ? '处理中...' : '重新编辑'}
            </button>
          )}
        </div>
      </div>

      {/* 恢复确认弹窗 */}
      {showRevert && (
        <RevertConfirm
          onConfirm={() => { setShowRevert(false); onRevert() }}
          onCancel={() => setShowRevert(false)}
        />
      )}
    </>
  )
}

function ModeBtn({
  label, active, onClick, borderLeft,
}: {
  label: string; active: boolean; onClick: () => void; borderLeft?: boolean
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '5px 12px',
        background: active ? '#1A1A1A' : 'transparent',
        color: active ? '#FFFFFF' : '#6B6B6B',
        border: 'none',
        borderLeft: borderLeft ? '1px solid #E8E4DD' : 'none',
        fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
      }}
    >
      {label}
    </button>
  )
}

function MetaTag({ label }: { label: string }) {
  return (
    <span style={{
      fontSize: 11, color: '#6B6B6B',
      background: '#F4F3F0', border: '1px solid #E8E4DD',
      borderRadius: 4, padding: '1px 6px',
    }}>
      {label}
    </span>
  )
}

function formatShortMonth(dateStr: string): string {
  const [y, m] = dateStr.split('-')
  return `${y}年${parseInt(m)}月`
}
```

---

### 7. SummaryPage：接入编辑器和操作栏

**修改 `app/summary/page.tsx`**，在 Task 15 基础上完善右侧内容区：

#### 新增 import 和状态

```typescript
import MarkdownEditor from '@/components/summary/MarkdownEditor'
import SummaryTopbar from '@/components/summary/SummaryTopbar'

// 新增状态
const [editorContent, setEditorContent] = useState('')
const [initialContent, setInitialContent] = useState('')   // 用于恢复上版
const [editorMode, setEditorMode] = useState<'edit' | 'preview'>('preview')
const [saving, setSaving] = useState(false)
```

#### 选中总结时同步 editorContent

在 `setSelectedId` 调用处（或单独 `useEffect`）：

```typescript
useEffect(() => {
  if (!selectedSummary) return
  setEditorContent(selectedSummary.content)
  setInitialContent(selectedSummary.content)
  // 草稿默认编辑模式，定稿默认预览模式
  setEditorMode(selectedSummary.is_draft ? 'edit' : 'preview')
}, [selectedId])
```

#### 切换到预览时自动保存草稿

```typescript
async function handleModeChange(mode: 'edit' | 'preview') {
  if (mode === 'preview' && selectedSummary?.is_draft && editorContent !== initialContent) {
    // 静默保存当前内容到 DB
    setSaving(true)
    try {
      await fetch(`/api/summary/${selectedSummary.id}/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editorContent }),
      })
      // 更新 initialContent（下次恢复的基准）
      setInitialContent(editorContent)
      // 同步 summaries 列表里的 content
      setSummaries(prev =>
        prev.map(s => s.id === selectedSummary.id ? { ...s, content: editorContent } : s)
      )
    } catch {
      // 保存失败不阻止切换
    } finally {
      setSaving(false)
    }
  }
  setEditorMode(mode)
}
```

#### 恢复上版

```typescript
function handleRevert() {
  setEditorContent(initialContent)
}
```

#### 存为定稿

```typescript
async function handleFinalize() {
  if (!selectedSummary) return
  // 先保存当前内容
  await fetch(`/api/summary/${selectedSummary.id}/update`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: editorContent }),
  })
  // 再定稿
  await fetch(`/api/summary/${selectedSummary.id}/finalize`, { method: 'POST' })
  // 更新本地状态
  setSummaries(prev =>
    prev.map(s =>
      s.id === selectedSummary.id
        ? { ...s, is_draft: false, content: editorContent, finalized_at: new Date().toISOString() }
        : s
    )
  )
  setInitialContent(editorContent)
  setEditorMode('preview')
}
```

#### 重新编辑

```typescript
async function handleReEdit() {
  if (!selectedSummary) return
  await fetch(`/api/summary/${selectedSummary.id}/re-edit`, { method: 'POST' })
  setSummaries(prev =>
    prev.map(s =>
      s.id === selectedSummary.id
        ? { ...s, is_draft: true, finalized_at: null }
        : s
    )
  )
  setEditorMode('edit')
}
```

#### 替换右侧内容区 JSX

将 Task 15 的 `<pre>` 占位替换为：

```typescript
{selectedSummary ? (
  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
    <SummaryTopbar
      summary={selectedSummary}
      content={editorContent}
      initialContent={initialContent}
      mode={editorMode}
      saving={saving}
      onModeChange={handleModeChange}
      onRevert={handleRevert}
      onFinalize={handleFinalize}
      onReEdit={handleReEdit}
      aiOpen={aiOpen}
      onAiToggle={() => setAiOpen(prev => !prev)}
    />
    <div style={{ flex: 1, overflowY: 'auto' }}>
      <MarkdownEditor
        content={editorContent}
        onChange={setEditorContent}
        mode={editorMode}
        locked={!selectedSummary.is_draft}
        onSwitchToEdit={() => setEditorMode('edit')}
      />
    </div>
  </div>
) : (
  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
    {/* 无选中时顶部仅显示页面标题 + AI 按钮 */}
    <div style={{
      height: 56, display: 'flex', alignItems: 'center',
      justifyContent: 'space-between', padding: '0 24px',
      borderBottom: '1px solid #F0EDE8', flexShrink: 0,
    }}>
      <span style={{ fontSize: 15, fontWeight: 500, color: '#1A1A1A' }}>汇报总结</span>
      <button
        onClick={() => setAiOpen(prev => !prev)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '6px 12px',
          background: aiOpen ? '#1D9E75' : '#E8F7F2',
          color: aiOpen ? '#FFFFFF' : '#0F6E56',
          border: `1px solid ${aiOpen ? '#1D9E75' : '#9FE1CB'}`,
          borderRadius: 7, fontSize: 12, fontWeight: 500,
          cursor: 'pointer', transition: 'all 0.15s ease',
        }}
      >
        ✦ AI 助手
      </button>
    </div>
    <div style={{ flex: 1, overflowY: 'auto' }}>
      <EmptyState />
    </div>
  </div>
)}
```

> 将原来顶部栏中的 AI 助手按钮也移除，统一由 `SummaryTopbar` 承载。

---

## 不做什么

```
❌ AI 替换建议卡片（Task 17 做）
❌ AiSidePanel 的 extraBodyParams 上下文注入（Task 17 完善）
❌ 字数统计 / 字符统计
❌ 导出功能
❌ 多个历史版本的版本树（只有「上一版」，不做版本树）
```

---

## 完成标准

```
□ 选中草稿总结 → 右侧默认进入编辑模式（JetBrains Mono textarea）
□ 选中定稿总结 → 右侧默认进入预览模式，textarea readonly
□ 操作栏左侧显示标题 + 报告类型标签 + 日期范围 + 草稿/定稿标签
□ 点「预览」→ 切换为渲染后的 Markdown 排版，同时静默保存到 DB
□ 点「编辑」→ 切回 textarea
□ 预览模式中 <!-- ai-guess: X --> 渲染为黄色左竖线块（「✦ AI 推测 · X」）
□ 预览模式中 <!-- placeholder: X --> 渲染为红色左竖线块（「⚠ 请补充：X」）
□ 点红色 placeholder 块 → 自动切换到编辑模式
□ 编辑内容后「↩ 恢复上版」出现，点击弹确认框
□ 确认恢复 → 内容恢复为上次保存时的版本，按钮消失
□ 取消 → 弹窗关闭，内容不变
□ 点「存为定稿」→ 内容保存并锁定，徽章变「定稿」，操作栏显示「重新编辑」
□ 定稿后 textarea 变 readonly（locked 样式）
□ 点「重新编辑」→ 徽章变回「草稿」，可编辑
□ 刷新页面 → 定稿/草稿状态和内容均从 DB 正确加载
□ 无 TypeScript 报错
□ npm run dev 无报错
```

---

## 做完后告诉我

1. 做了哪些文件
2. 编辑/预览切换是否正常，预览后内容是否自动保存到 DB
3. 特殊注释（ai-guess / placeholder）在预览模式下是否正确渲染
4. 存为定稿后是否锁定，重新编辑后是否可以继续编辑
5. 不要自动开始 task 17，等我验收

---

*Task 16 | 2026.04.24*
