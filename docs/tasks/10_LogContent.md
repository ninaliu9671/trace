# Task 10 · 维度目录 + 日志内容区（DimensionDirectory + LogContent + LogField）

> 完成本 task 后再开始 task 11。
> 完成标准：左栏维度目录展示、填写状态圆点正确，右栏按维度分组展示输入框，已有记录能正确加载显示，无 TS 报错。

---

## 前置要求

- Task 09 已完成并验收通过
- `Dimension`、`DailyLog` 类型已在 `/types/index.ts` 定义
- `/lib/supabase/client.ts` 已存在

---

## 这次要做什么

### 1. API Route：GET /api/log/[date]

**创建 `app/api/log/[date]/route.ts`**

返回指定日期该用户的所有日志记录：

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createSessionClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

export async function GET(
  req: NextRequest,
  { params }: { params: { date: string } }
) {
  try {
    const cookieStore = cookies()
    const sessionClient = createSessionClient(cookieStore)
    const { data: { user } } = await sessionClient.auth.getUser()
    if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })

    // 校验日期格式 YYYY-MM-DD
    if (!/^\d{4}-\d{2}-\d{2}$/.test(params.date)) {
      return NextResponse.json({ error: '日期格式错误' }, { status: 400 })
    }

    const serverClient = createServerClient()
    const { data: logs, error } = await serverClient
      .from('daily_logs')
      .select('*')
      .eq('user_id', user.id)
      .eq('log_date', params.date)

    if (error) throw error
    return NextResponse.json({ logs: logs ?? [] })
  } catch {
    return NextResponse.json({ error: '加载失败，请稍后重试' }, { status: 500 })
  }
}
```

---

### 2. 新增类型

**修改 `/types/index.ts`**，补充日志字段值的 map 类型（便于 LogPage 管理状态）：

```typescript
// 日志字段状态（key = dimension_id）
export interface LogFieldState {
  content: string
  isAiFilled: boolean
}
```

---

### 3. LogPage 拉取数据并管理状态

**修改 `app/log/page.tsx`**，在已有 state 基础上新增：

```typescript
import { Dimension, DailyLog, LogFieldState } from '@/types'
import { createClient } from '@/lib/supabase/client'

// 新增 state
const [dimensions, setDimensions] = useState<Dimension[]>([])
const [fieldStates, setFieldStates] = useState<Record<string, LogFieldState>>({})
const [locked, setLocked] = useState(false)          // 今天是否已保存（Task 11 控制）
const [savedAt, setSavedAt] = useState<string | null>(null)  // 保存时间
const [activeLeafId, setActiveLeafId] = useState<string | null>(null)
const [dataLoading, setDataLoading] = useState(true)
```

拉取维度（只需一次，挂载时执行）：

```typescript
useEffect(() => {
  async function fetchDimensions() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('dimensions')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('sort_order')

    setDimensions(data ?? [])
  }
  fetchDimensions()
}, [])
```

拉取日志（每次 `currentDate` 变化时执行）：

```typescript
useEffect(() => {
  async function fetchLogs() {
    setDataLoading(true)
    setFieldStates({})       // 切换日期时清空
    setLocked(false)
    setSavedAt(null)

    const dateStr = toDateString(currentDate)
    const res = await fetch(`/api/log/${dateStr}`)
    const data = await res.json()
    const logs: DailyLog[] = data.logs ?? []

    if (logs.length > 0) {
      const states: Record<string, LogFieldState> = {}
      for (const log of logs) {
        states[log.dimension_id] = {
          content: log.content,
          isAiFilled: log.is_ai_generated,
        }
      }
      setFieldStates(states)
      setLocked(true)
      setSavedAt(logs[0].updated_at ?? logs[0].created_at)
    }
    setDataLoading(false)
  }
  fetchLogs()
}, [currentDate])
```

`toDateString` 工具函数（与 DateNav 里相同，提取到 `lib/utils.ts`）：

**创建 `lib/utils.ts`**：

```typescript
export function toDateString(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
```

在 `DateNav.tsx` 和 `LogPage.tsx` 中都从 `@/lib/utils` 引入，删除各自重复定义。

更新字段值的函数（传给 LogContent）：

```typescript
function handleFieldChange(dimensionId: string, content: string, isAiFilled = false) {
  setFieldStates(prev => ({
    ...prev,
    [dimensionId]: { content, isAiFilled },
  }))
}
```

将左右两栏的占位 div 替换为真实组件：

```typescript
import DimensionDirectory from '@/components/log/DimensionDirectory'
import LogContent from '@/components/log/LogContent'

// 左栏替换：
<DimensionDirectory
  dimensions={dimensions}
  fieldStates={fieldStates}
  activeLeafId={activeLeafId}
  onLeafClick={setActiveLeafId}
/>

// 右栏替换：
<LogContent
  dimensions={dimensions}
  fieldStates={fieldStates}
  locked={locked}
  activeLeafId={activeLeafId}
  onFieldChange={handleFieldChange}
/>
```

---

### 4. DimensionDirectory

**创建 `components/log/DimensionDirectory.tsx`**

Props：

```typescript
interface DimensionDirectoryProps {
  dimensions: Dimension[]
  fieldStates: Record<string, LogFieldState>
  activeLeafId: string | null
  onLeafClick: (id: string) => void
}
```

`buildDimensionTree` 工具函数（与 task 07 相同逻辑，直接复制到文件顶部）。

填写状态计算：

```typescript
// 获取某节点下所有叶子节点（level 3）的 id
function getLeafIds(node: Dimension): string[] {
  if (node.level === 3) return [node.id]
  return (node.children ?? []).flatMap(getLeafIds)
}

// 计算节点的填写状态
function getFillStatus(node: Dimension, fieldStates: Record<string, LogFieldState>): 'full' | 'partial' | 'empty' {
  const leafIds = getLeafIds(node)
  if (leafIds.length === 0) return 'empty'
  const filled = leafIds.filter(id => fieldStates[id]?.content?.trim()).length
  if (filled === 0) return 'empty'
  if (filled === leafIds.length) return 'full'
  return 'partial'
}

// 状态圆点样式
function FillDot({ status }: { status: 'full' | 'partial' | 'empty' }) {
  if (status === 'empty') return (
    <span style={{
      width: 6, height: 6, borderRadius: '50%',
      border: '1.5px solid #D1CEC8', display: 'inline-block', flexShrink: 0,
    }} />
  )
  if (status === 'partial') return (
    <span style={{
      width: 6, height: 6, borderRadius: '50%',
      background: '#9FE1CB', display: 'inline-block', flexShrink: 0,
    }} />
  )
  return (
    <span style={{
      width: 6, height: 6, borderRadius: '50%',
      background: '#1D9E75', display: 'inline-block', flexShrink: 0,
    }} />
  )
}
```

目录渲染（level 1 + level 2，level 3 只显示在右栏）：

```typescript
export default function DimensionDirectory({
  dimensions, fieldStates, activeLeafId, onLeafClick,
}: DimensionDirectoryProps) {
  const tree = buildDimensionTree(dimensions)

  function handleClick(leafId: string) {
    onLeafClick(leafId)
    // 滚动右栏对应位置
    document.getElementById(`log-field-${leafId}`)?.scrollIntoView({
      behavior: 'smooth', block: 'start',
    })
  }

  return (
    <div style={{ padding: '8px 0' }}>
      {tree.map(level1 => {
        const l1Status = getFillStatus(level1, fieldStates)

        return (
          <div key={level1.id} style={{ marginBottom: 4 }}>
            {/* 一级维度标题 */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '6px 12px',
              cursor: 'default',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 13 }}>{level1.icon}</span>
                <span style={{ fontSize: 12, fontWeight: 500, color: '#1A1A1A' }}>
                  {level1.name}
                </span>
              </div>
              <FillDot status={l1Status} />
            </div>

            {/* 二级维度（可点击） */}
            {(level1.children ?? []).map(level2 => {
              const l2Status = getFillStatus(level2, fieldStates)
              // 取 level2 的第一个叶子 id 作为点击目标
              const firstLeafId = getLeafIds(level2)[0] ?? level2.id
              const isActive = level2.children?.some(l3 => l3.id === activeLeafId) ?? false

              return (
                <div
                  key={level2.id}
                  onClick={() => handleClick(firstLeafId)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '5px 12px 5px 26px',
                    cursor: 'pointer',
                    borderLeft: isActive ? '2px solid #1D9E75' : '2px solid transparent',
                    background: isActive ? '#F0FBF7' : 'transparent',
                    marginLeft: 2,
                  }}
                  onMouseEnter={e => {
                    if (!isActive)
                      (e.currentTarget as HTMLDivElement).style.background = '#F4F3F0'
                  }}
                  onMouseLeave={e => {
                    if (!isActive)
                      (e.currentTarget as HTMLDivElement).style.background = 'transparent'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 10, color: '#B0ADA6' }}>▸</span>
                    <span style={{
                      fontSize: 12,
                      color: isActive ? '#1D9E75' : l2Status !== 'empty' ? '#1A1A1A' : '#B0ADA6',
                    }}>
                      {level2.name}
                    </span>
                  </div>
                  <FillDot status={l2Status} />
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
```

---

### 5. LogContent

**创建 `components/log/LogContent.tsx`**

Props：

```typescript
interface LogContentProps {
  dimensions: Dimension[]
  fieldStates: Record<string, LogFieldState>
  locked: boolean
  activeLeafId: string | null
  onFieldChange: (dimensionId: string, content: string, isAiFilled?: boolean) => void
}
```

右栏按一级维度分区，每区内展示所有叶节点字段：

```typescript
export default function LogContent({
  dimensions, fieldStates, locked, activeLeafId, onFieldChange,
}: LogContentProps) {
  const tree = buildDimensionTree(dimensions)   // 同上，复制 buildDimensionTree 到文件顶部

  if (dimensions.length === 0) {
    return (
      <div style={{ padding: 24, color: '#B0ADA6', fontSize: 13 }}>
        还没有设置记录维度，请先到职业档案完善维度设置。
      </div>
    )
  }

  // 递归收集一个节点下的所有叶子节点（level 3），保留其父路径用于显示
  function collectLeaves(
    node: Dimension,
    path: string[] = []
  ): { leaf: Dimension; path: string[] }[] {
    if (node.level === 3) return [{ leaf: node, path }]
    return (node.children ?? []).flatMap(child =>
      collectLeaves(child, [...path, node.name])
    )
  }

  return (
    <div style={{ padding: '24px' }}>
      {tree.map(level1 => {
        const leaves = collectLeaves(level1)
        if (leaves.length === 0) return null

        return (
          <div key={level1.id} style={{ marginBottom: 32 }}>
            {/* 一级维度分区标题 */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 16,
              paddingBottom: 8,
              borderBottom: '1px solid #F0EDE8',
            }}>
              <span style={{ fontSize: 15 }}>{level1.icon}</span>
              <span style={{ fontSize: 13, fontWeight: 500, color: '#6B6B6B' }}>
                {level1.name}
              </span>
            </div>

            {/* 该区下的所有叶子字段 */}
            {leaves.map(({ leaf }) => (
              <LogField
                key={leaf.id}
                dimension={leaf}
                fieldState={fieldStates[leaf.id] ?? { content: '', isAiFilled: false }}
                locked={locked}
                isActive={activeLeafId === leaf.id}
                onChange={(content, isAiFilled) => onFieldChange(leaf.id, content, isAiFilled)}
              />
            ))}
          </div>
        )
      })}
    </div>
  )
}
```

---

### 6. LogField

**创建 `components/log/LogField.tsx`**

Props：

```typescript
interface LogFieldProps {
  dimension: Dimension          // level 3 叶节点
  fieldState: LogFieldState
  locked: boolean
  isActive: boolean
  onChange: (content: string, isAiFilled?: boolean) => void
}
```

输入框自动增高（`rows` 根据内容行数动态调整）：

```typescript
function autoRows(value: string): number {
  const lines = value.split('\n').length
  return Math.max(4, lines + 1)   // 最少 4 行
}
```

字段样式根据状态变化：

```typescript
function getFieldStyle(
  fieldState: LogFieldState,
  locked: boolean,
  focused: boolean
): React.CSSProperties {
  const base: React.CSSProperties = {
    width: '100%',
    padding: '9px 12px',
    fontSize: 13,
    fontFamily: 'inherit',
    lineHeight: 1.7,
    borderRadius: 7,
    outline: 'none',
    resize: 'none',
    transition: 'border-color 0.15s ease',
    minHeight: 72,
  }

  if (locked) return {
    ...base,
    border: '1px solid #F0EDE8',
    background: '#F8F7F4',
    cursor: 'default',
    color: '#6B6B6B',
  }

  if (fieldState.isAiFilled && fieldState.content) return {
    ...base,
    border: '1px solid #C5EAE0',
    background: '#F8FFFE',
    borderLeft: '2.5px solid #9FE1CB',
  }

  if (fieldState.content && !focused) return {
    ...base,
    border: '1px solid #E8E4DD',
    background: '#FDFFFE',
    borderLeft: '2.5px solid #1D9E75',
  }

  if (focused) return {
    ...base,
    border: '1px solid #1D9E75',
    background: '#FFFFFF',
  }

  return {
    ...base,
    border: '1px solid #E8E4DD',
    background: '#FFFFFF',
  }
}
```

完整组件：

```typescript
'use client'
import { useState, useRef } from 'react'
import { Dimension, LogFieldState } from '@/types'

export default function LogField({ dimension, fieldState, locked, isActive, onChange }: LogFieldProps) {
  const [focused, setFocused] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  return (
    <div
      id={`log-field-${dimension.id}`}    // 供 DimensionDirectory 的 scrollIntoView 定位
      style={{
        marginBottom: 20,
        scrollMarginTop: 16,              // 滚动时顶部留白
      }}
    >
      {/* 提示词标签 */}
      {dimension.prompt_text && (
        <div style={{
          fontSize: 11,
          color: isActive ? '#0F6E56' : '#B0ADA6',
          marginBottom: 5,
          lineHeight: 1.5,
          transition: 'color 0.15s ease',
        }}>
          {dimension.name}
          <span style={{ margin: '0 6px', color: '#E8E4DD' }}>·</span>
          {dimension.prompt_text}
        </div>
      )}

      {/* 输入框 */}
      <textarea
        ref={textareaRef}
        value={fieldState.content}
        onChange={e => {
          if (locked) return
          // 用户手动编辑 → 清除 AI 填入标记
          onChange(e.target.value, false)
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        readOnly={locked}
        rows={autoRows(fieldState.content)}
        placeholder={locked ? '' : (dimension.prompt_text ?? `记录 ${dimension.name}...`)}
        style={getFieldStyle(fieldState, locked, focused)}
      />

      {/* AI 填入标注 */}
      {fieldState.isAiFilled && fieldState.content && (
        <div style={{ fontSize: 11, color: '#9FE1CB', marginTop: 3 }}>
          ✦ 由 AI 助手填入
        </div>
      )}
    </div>
  )
}
```

---

### 7. 将 buildDimensionTree 提取到公共位置

`buildDimensionTree` 在 task 07（DimensionTabContent）、task 10（DimensionDirectory、LogContent）中都需要。

**创建 `lib/dimensionUtils.ts`**：

```typescript
import { Dimension } from '@/types'

export function buildDimensionTree(dims: Dimension[]): Dimension[] {
  const map: Record<string, Dimension> = {}
  const roots: Dimension[] = []

  for (const dim of dims) {
    map[dim.id] = { ...dim, children: [] }
  }

  for (const dim of Object.values(map)) {
    if (dim.parent_id && map[dim.parent_id]) {
      map[dim.parent_id].children!.push(dim)
    } else {
      roots.push(dim)
    }
  }

  function sortChildren(d: Dimension) {
    d.children?.sort((a, b) => a.sort_order - b.sort_order)
    d.children?.forEach(sortChildren)
  }
  roots.sort((a, b) => a.sort_order - b.sort_order)
  roots.forEach(sortChildren)

  return roots
}
```

`DimensionDirectory.tsx`、`LogContent.tsx`、`DimensionTabContent.tsx`（task 07）均从 `@/lib/dimensionUtils` 引入，删除各自重复定义。

---

## 不做什么

```
❌ 已保存横幅和保存按钮（Task 11 做）
❌ 底部保存按钮（Task 11 做）
❌ locked 状态的真实判断和切换（Task 11 完善，现在默认 false）
❌ AI 助手面板的上下文注入（Task 12 做）
❌ 图片上传（Task 12 做）
❌ recordDates 绿点填充（Task 11 拿到保存数据后回填）
```

---

## 完成标准

```
□ /log 页面左栏显示维度目录（一级 + 二级），不再是「加载中」占位
□ 一级维度显示 icon + 名称，右侧显示填写状态圆点
□ 二级维度显示 ▸ + 名称，右侧显示填写状态圆点
□ 右栏按一级维度分区，分区标题含 icon，每区展示所有叶字段
□ 叶字段上方显示「维度名 · 提示词」
□ 输入框初始状态：白色背景 + 灰色边框
□ 输入中（focus）：绿色边框
□ 有内容（手动）：左侧 2.5px 深绿竖线 + 极浅绿背景
□ 有内容时目录圆点变为深绿（全填）或浅绿（部分填）
□ 点目录二级条目 → 右栏平滑滚动到对应字段，条目高亮（绿色左竖线 + 浅绿背景）
□ 切换日期后字段内容清空（新日期无记录时）
□ 若该日期有已保存记录 → 字段内容正确加载，输入框 readonly
□ 无 TypeScript 报错
□ npm run dev 无报错
```

---

## 做完后告诉我

1. 做了哪些文件
2. 目录圆点状态是否随输入实时更新
3. 点目录条目是否能滚动到右栏对应字段
4. 已有记录的日期能否正确加载内容（locked 状态下 readonly）
5. 不要自动开始 task 11，等我验收

---

*Task 10 | 2026.04.24*
