# Task 11 · 日志保存/编辑状态管理（SaveButton + SavedBanner）

> 完成本 task 后再开始 task 12。
> 完成标准：保存流程完整（loading → 成功 → 横幅），编辑/锁定状态切换正确，日历绿点随保存更新，数据持久化到 Supabase。

---

## 前置要求

- Task 10 已完成并验收通过
- `DailyLog`、`LogFieldState` 类型已在 `/types/index.ts` 定义
- `/api/log/[date]` 已存在

---

## 这次要做什么

### 1. API Route：POST /api/log/save

**创建 `app/api/log/save/route.ts`**

策略：删除该用户该日期的所有旧记录，重新插入所有非空字段。

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createSessionClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

interface LogEntry {
  dimension_id: string
  content: string
  is_ai_generated: boolean
}

export async function POST(req: NextRequest) {
  try {
    const cookieStore = cookies()
    const sessionClient = createSessionClient(cookieStore)
    const { data: { user } } = await sessionClient.auth.getUser()
    if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })

    const { date, entries }: { date: string; entries: LogEntry[] } = await req.json()

    // 校验日期格式
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: '日期格式错误' }, { status: 400 })
    }

    const serverClient = createServerClient()

    // 1. 删除该日期旧记录
    const { error: deleteError } = await serverClient
      .from('daily_logs')
      .delete()
      .eq('user_id', user.id)
      .eq('log_date', date)

    if (deleteError) throw deleteError

    // 2. 过滤掉空内容，插入新记录
    const nonEmpty = entries.filter(e => e.content.trim())
    if (nonEmpty.length > 0) {
      const rows = nonEmpty.map(e => ({
        user_id: user.id,
        log_date: date,
        dimension_id: e.dimension_id,
        content: e.content.trim(),
        word_count: e.content.replace(/\s/g, '').length,
        is_ai_generated: e.is_ai_generated,
      }))

      const { error: insertError } = await serverClient
        .from('daily_logs')
        .insert(rows)

      if (insertError) throw insertError
    }

    return NextResponse.json({ ok: true, savedAt: new Date().toISOString() })
  } catch {
    return NextResponse.json({ error: '保存失败，请稍后重试' }, { status: 500 })
  }
}
```

---

### 2. 工具函数：格式化保存时间

**追加到 `lib/utils.ts`**：

```typescript
// 将 ISO 时间字符串格式化为「YYYY.MM.DD HH:mm」
export function formatSavedAt(isoString: string): string {
  const d = new Date(isoString)
  const y = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const h = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${y}.${mo}.${day} ${h}:${min}`
}
```

---

### 3. SavedBanner 组件

**创建 `components/log/SavedBanner.tsx`**

Props：

```typescript
interface SavedBannerProps {
  savedAt: string        // ISO 时间字符串
  onEdit: () => void     // 点「编辑」按钮
}
```

样式：绿色背景横幅，固定在两栏主区域上方（顶部栏下方）。

```typescript
import { formatSavedAt } from '@/lib/utils'

export default function SavedBanner({ savedAt, onEdit }: SavedBannerProps) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '9px 24px',
      background: '#F0FBF7',
      borderBottom: '1px solid #9FE1CB',
      flexShrink: 0,
    }}>
      <span style={{ fontSize: 13, color: '#0F6E56' }}>
        ✓ 本日记录已保存 · {formatSavedAt(savedAt)}
      </span>
      <button
        onClick={onEdit}
        style={{
          fontSize: 12,
          color: '#0F6E56',
          background: 'transparent',
          border: '1px solid #9FE1CB',
          borderRadius: 6,
          padding: '3px 12px',
          cursor: 'pointer',
        }}
      >
        编辑
      </button>
    </div>
  )
}
```

---

### 4. SaveButton 组件

**创建 `components/log/SaveButton.tsx`**

三种状态：默认 / 保存中 / 已保存。

Props：

```typescript
interface SaveButtonProps {
  onSave: () => Promise<void>
  disabled?: boolean
}
```

```typescript
'use client'
import { useState } from 'react'

type SaveState = 'idle' | 'saving' | 'saved'

export default function SaveButton({ onSave, disabled }: SaveButtonProps) {
  const [state, setState] = useState<SaveState>('idle')

  async function handleClick() {
    if (state !== 'idle' || disabled) return
    setState('saving')
    try {
      await onSave()
      setState('saved')
      // 「✓ 已保存」显示 1.2s 后，父组件切回横幅（通过 onSave 结束后 LogPage 设 locked）
      // 这里不需要再 setTimeout，LogPage 的 locked = true 会让按钮消失
    } catch {
      setState('idle')
    }
  }

  const configs: Record<SaveState, { label: string; bg: string; cursor: string }> = {
    idle:   { label: '💾 保存今日记录', bg: '#1A1A1A', cursor: 'pointer' },
    saving: { label: '保存中...',       bg: '#6B6B6B', cursor: 'default' },
    saved:  { label: '✓ 已保存',        bg: '#1D9E75', cursor: 'default' },
  }

  const cfg = configs[state]

  return (
    <div style={{
      position: 'sticky',
      bottom: 0,
      padding: '12px 24px',
      background: 'linear-gradient(to top, #F8F7F4 80%, transparent)',
    }}>
      <button
        onClick={handleClick}
        disabled={state !== 'idle' || disabled}
        style={{
          width: '100%',
          height: 44,
          background: cfg.bg,
          color: '#FFFFFF',
          border: 'none',
          borderRadius: 8,
          fontSize: 14,
          fontWeight: 500,
          cursor: cfg.cursor,
          transition: 'background 0.2s ease',
          fontFamily: 'inherit',
        }}
      >
        {cfg.label}
      </button>
    </div>
  )
}
```

---

### 5. LogPage：完整保存/编辑逻辑

**修改 `app/log/page.tsx`**

#### 新增 recordDates 状态（日历绿点）

```typescript
const [recordDates, setRecordDates] = useState<string[]>([])
```

挂载时拉取当前用户所有有记录的日期：

```typescript
// 在拉取 dimensions 的 useEffect 中追加：
const supabase = createClient()
const { data: { user } } = await supabase.auth.getUser()
if (!user) return

const { data: logDates } = await supabase
  .from('daily_logs')
  .select('log_date')
  .eq('user_id', user.id)

if (logDates) {
  const dates = [...new Set(logDates.map(r => r.log_date as string))]
  setRecordDates(dates)
}
```

将 `recordDates` 传入 `DateNav`（替换之前的空数组）：

```typescript
<DateNav
  currentDate={currentDate}
  onDateChange={setCurrentDate}
  recordDates={recordDates}   // ← 替换原来的 []
/>
```

#### 保存函数

```typescript
import { toDateString, formatSavedAt } from '@/lib/utils'

async function handleSave() {
  const dateStr = toDateString(currentDate)

  // 将 fieldStates 转为 entries 数组
  const entries = Object.entries(fieldStates).map(([dimension_id, state]) => ({
    dimension_id,
    content: state.content,
    is_ai_generated: state.isAiFilled,
  }))

  const res = await fetch('/api/log/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ date: dateStr, entries }),
  })
  const data = await res.json()
  if (data.error) throw new Error(data.error)

  // 更新保存时间和锁定状态
  setSavedAt(data.savedAt)

  // 等 1.2s 再切到 locked（让 SaveButton 的「✓ 已保存」显示一下）
  await new Promise(resolve => setTimeout(resolve, 1200))
  setLocked(true)

  // 更新日历绿点
  if (!recordDates.includes(dateStr)) {
    setRecordDates(prev => [...prev, dateStr])
  }
}
```

#### 编辑函数

```typescript
function handleEdit() {
  setLocked(false)
  setSavedAt(null)   // 隐藏横幅（locked 变 false 已能控制，但清掉更干净）
}
```

#### JSX 结构更新

在顶部栏和两栏主区域之间插入 `SavedBanner`（仅 locked 时显示）：

```typescript
import SavedBanner from '@/components/log/SavedBanner'
import SaveButton from '@/components/log/SaveButton'

// 顶部栏下方：
{locked && savedAt && (
  <SavedBanner
    savedAt={savedAt}
    onEdit={handleEdit}
  />
)}

// 两栏主区域内，右栏 div 末尾（LogContent 之后）：
{!locked && (
  <SaveButton
    onSave={handleSave}
    disabled={Object.values(fieldStates).every(s => !s.content.trim())}
  />
)}
```

完整右栏结构：

```typescript
<div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
  <LogContent
    dimensions={dimensions}
    fieldStates={fieldStates}
    locked={locked}
    activeLeafId={activeLeafId}
    onFieldChange={handleFieldChange}
  />
  {!locked && (
    <SaveButton
      onSave={handleSave}
      disabled={Object.values(fieldStates).every(s => !s.content.trim())}
    />
  )}
</div>
```

> `SaveButton` 用 `position: sticky; bottom: 0` 固定在右栏底部，不影响滚动区域。

---

### 6. 各日期状态的完整行为

| 场景 | 横幅 | 输入框 | 保存按钮 |
|------|------|--------|---------|
| 今天，无记录 | 不显示 | 可编辑 | 显示 |
| 今天，有记录（locked） | 显示 | readonly | 不显示 |
| 今天，有记录，点「编辑」 | 不显示 | 可编辑 | 显示 |
| 历史日期，无记录 | 不显示 | 可编辑 | 显示 |
| 历史日期，有记录（locked） | 显示 | readonly | 不显示 |
| 历史日期，有记录，点「编辑」 | 不显示 | 可编辑 | 显示 |

这些行为已由 Task 10 的 `locked` state + `fetchLogs` 逻辑覆盖，本 task 只是完善触发时机（保存后设 locked / 点编辑清 locked）。

---

### 7. 保存按钮 disabled 逻辑

按钮在以下情况禁用（但仍显示）：

- 所有字段均为空（`every(s => !s.content.trim())`）

不禁用：
- 至少一个字段有内容，无论是否 AI 填入

---

## 不做什么

```
❌ 字段级别的单独保存（整体一次保存所有字段）
❌ 自动保存 / 草稿功能
❌ 保存冲突处理（多端同步）
❌ AI 助手上下文注入（Task 12 做）
❌ 日志图片上传（Task 12 做）
```

---

## 完成标准

```
□ 无记录的日期：无横幅，输入框可编辑，底部显示「💾 保存今日记录」按钮
□ 所有字段为空时保存按钮 disabled（灰色/不可点）
□ 有内容时点保存按钮 → 按钮变「保存中...」（灰色背景）
□ 保存成功 → 按钮变「✓ 已保存」（绿色背景），持续 1.2s
□ 1.2s 后 → 底部按钮消失，顶部出现绿色「✓ 本日记录已保存 · YYYY.MM.DD HH:mm」横幅 + 「编辑」按钮
□ 所有输入框变为 readonly 状态（灰色背景，不可点击）
□ 点横幅「编辑」→ 横幅消失，输入框恢复可编辑，底部保存按钮重新出现
□ 再次保存 → 流程同上，横幅时间更新
□ 切换到其他日期 → 若有记录自动 locked + 横幅，若无记录则无横幅
□ 日历上刚保存的日期出现绿色小点
□ 进入页面时日历已有绿点标记所有有记录的历史日期
□ 无 TypeScript 报错
□ npm run dev 无报错
```

---

## 做完后告诉我

1. 做了哪些文件
2. 保存流程三个状态（保存中 → 已保存 → 横幅）是否正常过渡
3. 日历绿点是否正确更新（保存后立即出现，历史记录初始就有）
4. 不要自动开始 task 12，等我验收

---

*Task 11 | 2026.04.24*
