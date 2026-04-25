# Task 09 · LogPage 基础框架 + DateNav

> 完成本 task 后再开始 task 10。
> 完成标准：/log 页面布局正确，日期导航可切换前后天，日历浮层可弹出并选择日期，复用 Sidebar 和 AiSidePanel，无 TS 报错。

---

## 前置要求

- Task 07 已完成并验收通过（dimensions 表有数据，后续 task 10 读取）
- `Sidebar.tsx` 已存在（Task 01）
- `AiSidePanel.tsx` 已存在（Task 03）
- `PROMPTS.log_assistant` 已在 `/lib/prompts.ts` 定义

---

## 这次要做什么

### 1. PROMPTS.log_assistant 更新（与 Spec 12.2 对齐）

**修改 `/lib/prompts.ts`**，将 `log_assistant` 替换为完整版：

```typescript
log_assistant: `
你是用户的工作记录助手。用户会告诉你今天做了什么，你来帮他整理到对应的记录维度里。

【用户的维度结构】
{dimensions_tree}

【今天已有的记录内容】
{existing_logs}

【你的任务】
1. 理解用户描述的工作内容
2. 判断应该归到哪个最小层级维度（如果用户指定了就用指定的）
3. 整理成简洁、有信息量的一段话（50–150字）
4. 输出预览供用户确认

【输出格式】严格按以下 JSON，前后不加任何文字：
{
  "type": "log_preview",
  "items": [
    {
      "dimension_id": "xxx",
      "dimension_name": "需求分析 · 今日进展",
      "content": "整理后的内容"
    }
  ]
}

【注意】
- 只整理，不编造，内容必须来自用户说的
- 用户说了多件事，可以拆成多个 items 归不同维度
- 用汇报语气，不是日记语气
`.trim(),
```

---

### 2. API Route：/api/log/ai-chat（占位，Task 12 完善）

**创建 `app/api/log/ai-chat/route.ts`**

现在先建好结构，Task 12 再注入维度和已有记录上下文：

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
    }: {
      messages: AiMessage[]
      dimensionsTree: string
      existingLogs: string
    } = await req.json()

    const systemPrompt = PROMPTS.log_assistant
      .replace('{dimensions_tree}', dimensionsTree || '暂无维度数据')
      .replace('{existing_logs}', existingLogs || '今天暂无记录')

    const content = await callAI(
      messages.map(m => ({ role: m.role, content: m.content })),
      systemPrompt
    )

    // 尝试解析是否为 log_preview JSON
    let logPreview = null
    try {
      const parsed = JSON.parse(content)
      if (parsed?.type === 'log_preview') logPreview = parsed
    } catch {
      // 普通对话文字，忽略
    }

    return NextResponse.json({ content, logPreview })
  } catch {
    return NextResponse.json({ error: 'AI 服务暂时不可用，请稍后重试' }, { status: 500 })
  }
}
```

---

### 3. /log 页面主布局

**创建 `app/log/page.tsx`**

```typescript
'use client'
import { useState } from 'react'
import Sidebar from '@/components/layout/Sidebar'
import AiSidePanel from '@/components/AiSidePanel'
import DateNav from '@/components/log/DateNav'
import { PROMPTS } from '@/lib/prompts'

export default function LogPage() {
  const [currentDate, setCurrentDate] = useState<Date>(new Date())
  const [aiOpen, setAiOpen] = useState(false)

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#F8F7F4', overflow: 'hidden' }}>
      {/* 左侧导航栏 */}
      <Sidebar />

      {/* 主内容区 */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        marginRight: aiOpen ? 280 : 0,
        transition: 'margin-right 0.2s ease',
      }}>
        {/* 顶部栏 */}
        <div style={{
          height: 56,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
          borderBottom: '1px solid #F0EDE8',
          flexShrink: 0,
          background: '#F8F7F4',
        }}>
          {/* 左：标题 */}
          <span style={{ fontSize: 16, fontWeight: 500, color: '#1A1A1A' }}>
            工作日志
          </span>

          {/* 中：日期导航 */}
          <DateNav
            currentDate={currentDate}
            onDateChange={setCurrentDate}
            recordDates={[]}   // Task 11 填入真实数据
          />

          {/* 右：AI 助手按钮 */}
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
        </div>

        {/* 已保存横幅（Task 11 实现，先占位不显示） */}
        {/* SavedBanner 组件在 task 11 中创建 */}

        {/* 两栏主区域 */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* 左栏：维度目录（Task 10 实现，先占位） */}
          <div style={{
            width: 162,
            flexShrink: 0,
            borderRight: '1px solid #F0EDE8',
            background: '#FAFAF8',
            padding: '16px 0',
            overflowY: 'auto',
          }}>
            <div style={{ padding: '0 12px', fontSize: 12, color: '#B0ADA6' }}>
              维度目录加载中...
            </div>
          </div>

          {/* 右栏：内容区（Task 10 实现，先占位） */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '24px',
          }}>
            <div style={{ fontSize: 13, color: '#B0ADA6' }}>
              请从左侧选择维度，或等待 Task 10 实现内容区。
            </div>
          </div>
        </div>
      </div>

      {/* AI 面板 */}
      <AiSidePanel
        isOpen={aiOpen}
        onClose={() => setAiOpen(false)}
        contextLabel="已读取：今日工作记录"
        systemPrompt={PROMPTS.log_assistant
          .replace('{dimensions_tree}', '（待加载）')
          .replace('{existing_logs}', '（待加载）')}
        apiRoute="/api/log/ai-chat"
      />
    </div>
  )
}
```

---

### 4. DateNav 组件

**创建 `components/log/DateNav.tsx`**

Props：

```typescript
interface DateNavProps {
  currentDate: Date
  onDateChange: (date: Date) => void
  recordDates: string[]   // 格式 'YYYY-MM-DD'，日历上标绿点
}
```

日期格式化工具函数（定义在文件顶部）：

```typescript
const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

function formatDateLabel(date: Date): string {
  const y = date.getFullYear()
  const m = date.getMonth() + 1
  const d = date.getDate()
  const w = WEEKDAYS[date.getDay()]
  return `${y}年${m}月${d}日 周${w}`
}

function toDateString(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function isSameDay(a: Date, b: Date): boolean {
  return toDateString(a) === toDateString(b)
}
```

组件实现：

```typescript
'use client'
import { useState, useRef, useEffect } from 'react'

export default function DateNav({ currentDate, onDateChange, recordDates }: DateNavProps) {
  const [showCalendar, setShowCalendar] = useState(false)
  const calendarRef = useRef<HTMLDivElement>(null)

  // 点击外部关闭日历
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (calendarRef.current && !calendarRef.current.contains(e.target as Node)) {
        setShowCalendar(false)
      }
    }
    if (showCalendar) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showCalendar])

  function goToPrev() {
    const d = new Date(currentDate)
    d.setDate(d.getDate() - 1)
    onDateChange(d)
  }

  function goToNext() {
    const d = new Date(currentDate)
    d.setDate(d.getDate() + 1)
    onDateChange(d)
  }

  const isToday = isSameDay(currentDate, new Date())

  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 4 }}>
      {/* 前一天 */}
      <button
        onClick={goToPrev}
        style={{
          width: 28, height: 28,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: '1px solid #E8E4DD', borderRadius: 6,
          background: 'transparent', cursor: 'pointer',
          fontSize: 14, color: '#6B6B6B',
        }}
      >
        ‹
      </button>

      {/* 日期显示区（点击弹日历） */}
      <button
        onClick={() => setShowCalendar(prev => !prev)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '5px 12px',
          border: '1px solid #E8E4DD',
          borderRadius: 6,
          background: 'transparent',
          cursor: 'pointer',
          fontSize: 13,
          color: '#1A1A1A',
          fontFamily: 'inherit',
        }}
      >
        {/* 今天：左侧绿色圆点 */}
        {isToday && (
          <span style={{
            width: 6, height: 6,
            borderRadius: '50%',
            background: '#1D9E75',
            flexShrink: 0,
          }} />
        )}
        <span>{formatDateLabel(currentDate)}</span>
        <span style={{ fontSize: 10, color: '#B0ADA6' }}>▾</span>
      </button>

      {/* 后一天 */}
      <button
        onClick={goToNext}
        style={{
          width: 28, height: 28,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: '1px solid #E8E4DD', borderRadius: 6,
          background: 'transparent', cursor: 'pointer',
          fontSize: 14, color: '#6B6B6B',
        }}
      >
        ›
      </button>

      {/* 日历浮层 */}
      {showCalendar && (
        <div ref={calendarRef} style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', marginTop: 6, zIndex: 50 }}>
          <CalendarPopup
            selectedDate={currentDate}
            recordDates={recordDates}
            onSelect={(date) => {
              onDateChange(date)
              setShowCalendar(false)
            }}
          />
        </div>
      )}
    </div>
  )
}
```

---

### 5. CalendarPopup 组件

定义在同文件 `components/log/DateNav.tsx` 末尾（不单独建文件）。

```typescript
interface CalendarPopupProps {
  selectedDate: Date
  recordDates: string[]
  onSelect: (date: Date) => void
}

function CalendarPopup({ selectedDate, recordDates, onSelect }: CalendarPopupProps) {
  const [viewYear, setViewYear] = useState(selectedDate.getFullYear())
  const [viewMonth, setViewMonth] = useState(selectedDate.getMonth())   // 0-indexed

  const today = new Date()
  const recordSet = new Set(recordDates)

  // 当月第一天是星期几（0=日，1=一...）
  const firstDayOfMonth = new Date(viewYear, viewMonth, 1).getDay()
  // 当月天数
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
  }

  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
  }

  // 构建日历格子（前补空格，后补空格凑满 6 行）
  const cells: (number | null)[] = [
    ...Array(firstDayOfMonth).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  // 补足到 42 格（6行 × 7列）
  while (cells.length < 42) cells.push(null)

  return (
    <div style={{
      background: '#FFFFFF',
      border: '1px solid #E8E4DD',
      borderRadius: 10,
      padding: '14px',
      boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
      width: 240,
    }}>
      {/* 月份导航 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <button onClick={prevMonth} style={navBtnStyle}>‹</button>
        <span style={{ fontSize: 13, fontWeight: 500, color: '#1A1A1A' }}>
          {viewYear}年{viewMonth + 1}月
        </span>
        <button onClick={nextMonth} style={navBtnStyle}>›</button>
      </div>

      {/* 星期标题 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 6 }}>
        {['日', '一', '二', '三', '四', '五', '六'].map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: 11, color: '#B0ADA6', padding: '2px 0' }}>
            {d}
          </div>
        ))}
      </div>

      {/* 日期格子 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px 0' }}>
        {cells.map((day, idx) => {
          if (!day) return <div key={idx} />

          const cellDate = new Date(viewYear, viewMonth, day)
          const dateStr = toDateString(cellDate)
          const isSelected = isSameDay(cellDate, selectedDate)
          const isTodayCell = isSameDay(cellDate, today)
          const hasRecord = recordSet.has(dateStr)

          return (
            <div
              key={idx}
              onClick={() => onSelect(cellDate)}
              style={{
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: '4px 2px',
                cursor: 'pointer',
                borderRadius: 6,
                background: isSelected ? '#1D9E75' : isTodayCell ? '#F0FBF7' : 'transparent',
              }}
              onMouseEnter={e => {
                if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = '#F4F3F0'
              }}
              onMouseLeave={e => {
                if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = isTodayCell ? '#F0FBF7' : 'transparent'
              }}
            >
              <span style={{
                fontSize: 12,
                color: isSelected ? '#FFFFFF' : isTodayCell ? '#1D9E75' : '#1A1A1A',
                fontWeight: isSelected || isTodayCell ? 500 : 400,
                lineHeight: 1.5,
              }}>
                {day}
              </span>
              {/* 有记录绿点 */}
              {hasRecord && !isSelected && (
                <span style={{
                  width: 4, height: 4,
                  borderRadius: '50%',
                  background: '#1D9E75',
                  marginTop: 1,
                }} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// 月份导航按钮样式
const navBtnStyle: React.CSSProperties = {
  width: 24, height: 24,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  border: 'none', background: 'transparent',
  fontSize: 16, color: '#6B6B6B', cursor: 'pointer',
  borderRadius: 4,
}
```

---

### 6. 为 /log 创建专属布局（可选）

如果需要 /log 独立于 /profile 的布局（避免 Sidebar 的 activeTab 显示冲突），可将 `/log` 和 `/summary` 的 Sidebar 激活态单独处理。

`Sidebar.tsx` 已通过 `usePathname()` 判断激活项，访问 `/log` 时「工作日志」自动高亮，无需额外处理。

---

## 不做什么

```
❌ 左栏维度目录（Task 10 做）
❌ 右栏内容字段（Task 10 做）
❌ 已保存横幅和保存按钮（Task 11 做）
❌ 日志数据的读取（Task 10 做）
❌ recordDates 的真实数据填充（Task 11 做，现在传空数组）
❌ AI 助手的维度上下文注入（Task 12 做）
❌ /log/[date] 动态路由（MVP 用 state 管理日期即可）
```

---

## 完成标准

```
□ 访问 /log → 正确显示页面（Sidebar 「工作日志」高亮）
□ 顶部栏：左侧「工作日志」标题，中间日期导航，右侧「✦ AI 助手」按钮
□ 今天的日期：导航按钮左侧有绿色小圆点
□ 点「‹」→ 日期减一天，显示正确
□ 点「›」→ 日期加一天，显示正确
□ 点中间日期区域 → 日历浮层弹出（正确定位在按钮下方）
□ 日历显示正确月份，星期标题行正确（日一二三四五六）
□ 今天的日期在日历上有高亮样式（浅绿背景 + 绿色文字）
□ 点日历里的日期 → 日历关闭，顶部日期更新
□ 点日历外部区域 → 日历关闭
□ 月份切换按钮（‹ ›）正确跨年
□ 点「✦ AI 助手」→ 面板从右侧滑出，主内容区压缩
□ 两栏布局存在（左 162px 占位 + 右 flex-1 占位）
□ 无 TypeScript 报错
□ npm run dev 无报错
```

---

## 做完后告诉我

1. 做了哪些文件
2. 日历的星期对齐有没有问题（每月1日是否在正确的星期列）
3. 日期切换后顶部显示是否正确（年月日 + 星期几）
4. 不要自动开始 task 10，等我验收

---

*Task 09 | 2026.04.24*
