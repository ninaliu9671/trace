# Report Node Editor Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 移除"触发方式/汇报周期/依赖上层节点"三个字段，新增"汇报风格"字段（AI引导填写），并将"包含模块"改为三级标题+描述的竖向卡片布局。

**Architecture:** 字段变更贯穿四层：TypeScript 类型 → Supabase 数据库 → API 路由 → 前端 Modal。AI prompt 同步更新以反映新字段语义。移除的字段列（数据库保留，仅停止写入）不影响现有数据。

**Tech Stack:** Next.js App Router, TypeScript, Supabase (PostgreSQL), inline styles (no Tailwind)

---

## 文件地图

| 文件 | 操作 | 职责 |
|---|---|---|
| `types/index.ts` | Modify | 更新 `ReportNode`、`ProfilePreviewReportNode`、`OnboardingReportNode` 接口 |
| `app/api/report-nodes/save/route.ts` | Modify | 移除旧字段写入，加入 `style` |
| `app/api/report-nodes/delete/route.ts` | Create | 软删除 API（set is_active = false） |
| `components/profile/ReportNodeEditor.tsx` | Modify | 重写 Modal 表单：去掉3字段，加汇报风格，改模块布局 |
| `components/profile/ReportNodeTree.tsx` | Modify | 加删除按钮、移除 trigger_desc 显示 |
| `components/profile/ReportTabContent.tsx` | Modify | 处理 onNodeDeleted 回调 |
| `lib/prompts.ts` | Modify | 更新 profile_advisor 汇报框架区块、JSON 模板、引导语 |

---

### Task 1: 更新 TypeScript 类型

**Files:**
- Modify: `types/index.ts`

- [ ] **Step 1: 修改 `ReportNode` 接口，移除3个字段，新增 `style`**

打开 `types/index.ts`，将第 19–31 行的 `ReportNode` 改为：

```typescript
export interface ReportNode {
  id: string
  user_id: string
  name: string
  audience: string | null
  style: string | null          // 汇报风格（新增）
  modules: ReportModule[]
  sort_order: number
  is_active: boolean
  // 以下字段数据库保留，前端不再写入
  trigger_desc?: string | null
  time_granularity?: string | null
  parent_id?: string | null
  children?: ReportNode[]
}
```

- [ ] **Step 2: 更新 `ProfilePreviewReportNode`（AI预览用）**

将第 141–148 行改为：

```typescript
export interface ProfilePreviewReportNode {
  name: string
  audience?: string | null
  style?: string | null
  modules?: ReportModule[]
}
```

- [ ] **Step 3: 更新 `OnboardingReportNode`（onboarding写入用）**

将第 189–196 行改为：

```typescript
export interface OnboardingReportNode {
  name: string
  audience: string | null
  style: string | null
  modules: ReportModule[]
}
```

- [ ] **Step 4: 确认编译无报错**

```bash
npx tsc --noEmit 2>&1 | head -40
```

如有报错，根据提示修复（主要是 onboarding 相关代码引用了被移除的字段）。

- [ ] **Step 5: Commit**

```bash
git add types/index.ts
git commit -m "refactor(types): update ReportNode — drop trigger/cycle/parent, add style"
```

---

### Task 2: Supabase 数据库迁移

**Files:**
- Create: `supabase/migrations/20260427_report_nodes_add_style.sql`（如无 migrations 目录则直接在 Supabase SQL Editor 执行）

- [ ] **Step 1: 写迁移 SQL**

```sql
-- 新增 style 列（已有列不动，不删除旧列以保留历史数据）
ALTER TABLE report_nodes
  ADD COLUMN IF NOT EXISTS style TEXT;
```

- [ ] **Step 2: 在 Supabase Dashboard → SQL Editor 执行上述 SQL**

执行后检查：

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'report_nodes'
ORDER BY ordinal_position;
```

期望看到 `style | text` 列已存在。

- [ ] **Step 3: Commit（如有 migrations 文件夹）**

```bash
git add supabase/migrations/
git commit -m "chore(db): add style column to report_nodes"
```

---

### Task 3: 更新 API 保存路由

**Files:**
- Modify: `app/api/report-nodes/save/route.ts`

- [ ] **Step 1: 重写 route.ts，移除旧字段，加入 style**

将整个文件改为：

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createSessionClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const sessionClient = await createSessionClient()
    const { data: { user } } = await sessionClient.auth.getUser()
    if (!user) {
      console.error('[report-nodes/save] no user in session - cookies may not be forwarded')
      return NextResponse.json({ error: '未登录' }, { status: 401 })
    }

    const body = await req.json()

    const fields = {
      name: body.name,
      audience: body.audience ?? null,
      style: body.style ?? null,
      modules: body.modules ?? [],
    }

    if (body.id) {
      const { data, error } = await sessionClient
        .from('report_nodes')
        .update(fields)
        .eq('id', body.id)
        .eq('user_id', user.id)
        .select()
        .single()
      if (error) throw error
      return NextResponse.json({ node: data })
    } else {
      const { data, error } = await sessionClient
        .from('report_nodes')
        .insert({
          user_id: user.id,
          ...fields,
          sort_order: body.sort_order ?? 99,
          is_active: true,
        })
        .select()
        .single()
      if (error) throw error
      return NextResponse.json({ node: data })
    }
  } catch (e) {
    const msg = (e as { message?: string })?.message || String(e)
    console.error('[report-nodes/save] error:', msg, e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/report-nodes/save/route.ts
git commit -m "feat(api): report-nodes/save — remove trigger/cycle/parent, add style"
```

---

### Task 4: 重写 ReportNodeEditor Modal

**Files:**
- Modify: `components/profile/ReportNodeEditor.tsx`

目标布局：
1. 汇报名称（必填，保留）
2. 汇报对象（保留）
3. 汇报风格（新增 textarea，带 AI 示例提示）
4. 包含模块（竖向卡片：### 标题行 + 描述 textarea）

- [ ] **Step 1: 替换整个 ReportNodeEditor.tsx**

```tsx
'use client'
import { useEffect, useState } from 'react'
import { ReportModule, ReportNode } from '@/types'

interface ReportNodeEditorProps {
  node: ReportNode | null
  allNodes: ReportNode[]
  onSaved: (node: ReportNode) => void
  onClose: () => void
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  border: '1px solid #E8E4DD',
  borderRadius: 7,
  padding: '6px 9px',
  fontSize: 13,
  color: '#1A1A1A',
  background: '#F8F7F4',
  outline: 'none',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  fontWeight: 500,
  color: '#B0ADA6',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  marginBottom: 5,
}

const STYLE_PLACEHOLDER = `描述你在这类汇报中的风格偏好，例如：
• 汇报重点：以结果和数据驱动，突出 ROI
• 对象关注点：老板更在意风险和资源，不关心技术细节
• 语气风格：简洁直接，结论前置，避免废话`

export default function ReportNodeEditor({ node, allNodes, onSaved, onClose }: ReportNodeEditorProps) {
  const [form, setForm] = useState({
    name: node?.name ?? '',
    audience: node?.audience ?? '',
    style: node?.style ?? '',
  })
  const [modules, setModules] = useState<ReportModule[]>(node?.modules ?? [])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  function addModule() {
    setModules(prev => [...prev, { id: Date.now().toString(), name: '', description: '' }])
  }

  function updateModule(id: string, field: 'name' | 'description', value: string) {
    setModules(prev => prev.map(m => m.id === id ? { ...m, [field]: value } : m))
  }

  function removeModule(id: string) {
    setModules(prev => prev.filter(m => m.id !== id))
  }

  async function handleSave() {
    if (!form.name.trim()) {
      setError('汇报名称不能为空')
      return
    }
    setSaving(true)
    setError('')

    const payload = {
      ...(node?.id ? { id: node.id } : {}),
      name: form.name.trim(),
      audience: form.audience || null,
      style: form.style || null,
      modules: modules.filter(m => m.name.trim()),
      sort_order: node?.sort_order ?? 99,
    }

    try {
      const res = await fetch('/api/report-nodes/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      onSaved(data.node)
    } catch (e) {
      setError((e as Error).message || '保存失败，请稍后重试')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        backdropFilter: 'blur(2px)',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        style={{
          width: 520,
          background: '#FFFFFF',
          borderRadius: 12,
          overflow: 'hidden',
          boxShadow: '0 8px 40px rgba(0,0,0,0.15)',
        }}
      >
        {/* 头部 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 22px',
            borderBottom: '1px solid #E8E4DD',
          }}
        >
          <span style={{ fontSize: 15, fontWeight: 500, color: '#1A1A1A' }}>
            {node ? '编辑汇报层级' : '新增汇报层级'}
          </span>
          <span
            style={{ fontSize: 20, color: '#B0ADA6', cursor: 'pointer', lineHeight: 1 }}
            onClick={onClose}
          >
            ×
          </span>
        </div>

        {/* 内容区 */}
        <div style={{ padding: '18px 22px', maxHeight: '70vh', overflowY: 'auto' }}>

          {/* 汇报名称 */}
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>汇报名称 *</label>
            <input
              style={inputStyle}
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="如「周报」「季度述职」"
            />
          </div>

          {/* 汇报对象 */}
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>汇报对象</label>
            <input
              style={inputStyle}
              value={form.audience}
              onChange={e => setForm(f => ({ ...f, audience: e.target.value }))}
              placeholder="如「直属总监」「财务总监」"
            />
          </div>

          {/* 汇报风格 */}
          <div style={{ marginBottom: 18 }}>
            <label style={labelStyle}>汇报风格</label>
            <textarea
              style={{
                ...inputStyle,
                minHeight: 90,
                resize: 'vertical',
                lineHeight: 1.6,
              }}
              value={form.style}
              onChange={e => setForm(f => ({ ...f, style: e.target.value }))}
              placeholder={STYLE_PLACEHOLDER}
            />
            <div style={{ marginTop: 5, fontSize: 11, color: '#B0ADA6', lineHeight: 1.5 }}>
              可以描述：汇报重点、对象最在意什么、偏好的语气风格（口语化/正式/数据驱动等）
            </div>
          </div>

          {/* 包含模块 */}
          <div style={{ marginBottom: 6 }}>
            <label style={labelStyle}>包含模块</label>
            {modules.map((m, idx) => (
              <div
                key={m.id}
                style={{
                  border: '1px solid #E8E4DD',
                  borderRadius: 8,
                  padding: '10px 12px',
                  marginBottom: 8,
                  background: '#F8F7F4',
                  position: 'relative',
                }}
              >
                {/* 三级标题行 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <span style={{ fontSize: 12, color: '#B0ADA6', fontWeight: 600, flexShrink: 0 }}>
                    ###
                  </span>
                  <input
                    value={m.name}
                    onChange={e => updateModule(m.id, 'name', e.target.value)}
                    placeholder={`模块标题，如「核心项目进展」`}
                    style={{
                      ...inputStyle,
                      fontSize: 14,
                      fontWeight: 600,
                      background: 'transparent',
                      border: 'none',
                      borderBottom: '1px solid #E8E4DD',
                      borderRadius: 0,
                      padding: '2px 0',
                      flex: 1,
                    }}
                  />
                  <button
                    onClick={() => removeModule(m.id)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#B0ADA6',
                      fontSize: 16,
                      cursor: 'pointer',
                      padding: '0 2px',
                      flexShrink: 0,
                      lineHeight: 1,
                    }}
                  >
                    ×
                  </button>
                </div>
                {/* 描述行 */}
                <textarea
                  value={m.description}
                  onChange={e => updateModule(m.id, 'description', e.target.value)}
                  placeholder="描述这个模块应包含哪些内容，如「本周推进的主要项目，含里程碑和阻塞点」"
                  style={{
                    ...inputStyle,
                    background: 'transparent',
                    border: 'none',
                    padding: '2px 0 0 22px',
                    fontSize: 12,
                    color: '#6B6B6B',
                    minHeight: 48,
                    resize: 'none',
                    lineHeight: 1.6,
                  }}
                />
              </div>
            ))}
            <button
              onClick={addModule}
              style={{
                background: 'transparent',
                border: '1px dashed #E8E4DD',
                borderRadius: 6,
                padding: '5px 12px',
                fontSize: 12,
                color: '#6B6B6B',
                cursor: 'pointer',
                marginTop: 2,
              }}
            >
              + 添加模块
            </button>
          </div>
        </div>

        {/* 底部操作 */}
        <div
          style={{
            padding: '14px 22px',
            borderTop: '1px solid #E8E4DD',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ fontSize: 12, color: '#D94F4F' }}>{error}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={onClose}
              disabled={saving}
              style={{
                padding: '6px 14px',
                background: 'transparent',
                border: '1px solid #E8E4DD',
                borderRadius: 7,
                fontSize: 13,
                color: '#6B6B6B',
                cursor: saving ? 'not-allowed' : 'pointer',
              }}
            >
              取消
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                padding: '6px 14px',
                background: saving ? '#6B6B6B' : '#1D9E75',
                border: 'none',
                borderRadius: 7,
                fontSize: 13,
                fontWeight: 500,
                color: '#FFFFFF',
                cursor: saving ? 'not-allowed' : 'pointer',
              }}
            >
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/profile/ReportNodeEditor.tsx
git commit -m "feat(ui): ReportNodeEditor — add style field, H3+desc module layout, drop 3 fields"
```

---

### Task 5: 更新 AI Prompt（profile_advisor 汇报框架区块）

**Files:**
- Modify: `lib/prompts.ts` (lines 101–109)

- [ ] **Step 1: 替换 profile_advisor 中"汇报框架"区块（101–109 行）**

将：
```
▸ 汇报框架（current_focus = 'report'）
  收集信息：汇报周期、汇报对象、每层汇报包含的主要模块
  对话策略：
  - 已有框架内容作为基础，问用户是要新建还是调整
  - 从最高层级（年报/述职）往下问到日常记录
  - 每层确认：名称、触发时机、汇报对象、包含模块
  - 节点数量通常 3-6 个，子节点 parent_id 填父节点的 name
  收集完毕后生成预览，只输出纯 JSON：
  {"type":"profile_preview","target":"report","content":[{"name":"年度述职","trigger_desc":"每年12月","audience":"VP","time_granularity":"annual","parent_id":null,"modules":[{"id":"m1","name":"全年贡献","description":"主导项目交付结果"}]}]}
```

改为：
```
▸ 汇报框架（current_focus = 'report'）
  收集信息：每层汇报的名称、汇报对象、汇报风格、包含模块（三级标题+描述）
  对话策略：
  - 已有框架内容作为基础，问用户是要新建还是调整
  - 从最高层级（年报/述职）往下问到日常记录
  - 每层确认：名称、汇报对象、汇报风格、包含哪些模块
  - 汇报风格引导用户思考三个维度：
      ① 汇报重点（结果导向？过程说明？风险预警？）
      ② 对象最在意什么（ROI？团队稳定性？技术风险？）
      ③ 偏好语气（口语亲切/正式严谨/数据驱动）
  - 可主动提供风格示例，如「你的老板是 VP 财务，通常关注数字和风险，建议风格：结论前置，数据支撑，不超过三个要点」
  - 模块用三级标题+描述格式，名称简洁（如「核心项目进展」），描述说明该模块写什么
  - 节点数量通常 3-6 个
  收集完毕后生成预览，只输出纯 JSON：
  {"type":"profile_preview","target":"report","content":[{"name":"年度述职","audience":"财务VP","style":"结论前置，数据支撑；对象关注财务 ROI 和风险控制，避免技术细节","modules":[{"id":"m1","name":"全年核心成果","description":"量化收益最显著的3-5个项目，含投入产出比"},{"id":"m2","name":"重点风险与应对","description":"本年度主要风险项及已采取的控制措施"}]}]}
```

- [ ] **Step 2: 同步更新 profile_advisor 第 13–14 行附近的 `{report_nodes}` 上下文说明（如有字段描述）**

检查 `lib/prompts.ts` 前30行中是否有对 `trigger_desc` / `time_granularity` / `parent_id` 字段的说明，如有则更新为只提 `audience`、`style`、`modules`。

运行：
```bash
grep -n "trigger_desc\|time_granularity\|parent_id\|触发方式\|汇报周期\|依赖上层" lib/prompts.ts
```

对每处出现逐一判断：
- 在 JSON 模板里 → 删除
- 在说明文字里 → 改为新字段描述

- [ ] **Step 3: Commit**

```bash
git add lib/prompts.ts
git commit -m "feat(prompt): update report framework guidance — add style, H3 modules, drop trigger/cycle/parent"
```

---

### Task 6: 修复因类型变更引发的 TypeScript 报错

**Files:**
- Modify: `app/profile/page.tsx`（如引用了 `trigger_desc` / `time_granularity` / `parent_id`）
- Modify: `components/profile/ReportNodeTree.tsx`（如使用了 `parent_id` 排序树）

- [ ] **Step 1: 全局检查引用**

```bash
npx tsc --noEmit 2>&1
```

- [ ] **Step 2: 修复 page.tsx 中的 handlePreviewAdopt**

在 `app/profile/page.tsx` 找到 `handlePreviewAdopt`，其中构建 `ReportNode` payload 时可能引用旧字段。将旧字段赋值行删除，加入 `style`:

```typescript
// 原来可能有：trigger_desc: node.trigger_desc ?? null,
// 删除以上行，改为：
style: node.style ?? null,
```

- [ ] **Step 3: 检查 ReportNodeTree.tsx 的 parent_id 依赖**

`ReportNodeTree` 的 `buildTree()` 函数使用 `parent_id` 构建树。由于新节点 `parent_id` 均为 `null`（顶层），树渲染会退化为平铺列表，无需改动逻辑，只需确认 TypeScript 不报错。

`parent_id` 在类型中标为可选（`parent_id?: string | null`），`buildTree` 使用 `n.parent_id ?? null` 即可。检查 `ReportNodeTree.tsx` 中的引用，如有必要加 `??` 处理可选字段。

- [ ] **Step 4: 再次确认无 TypeScript 报错**

```bash
npx tsc --noEmit 2>&1
```

期望：无输出（零错误）

- [ ] **Step 5: Commit**

```bash
git add app/profile/page.tsx components/profile/ReportNodeTree.tsx
git commit -m "fix(ts): update report node references after field restructure"
```

---

---

### Task 7: 每个节点卡片加删除按钮

**Files:**
- Create: `app/api/report-nodes/delete/route.ts`
- Modify: `components/profile/ReportNodeTree.tsx`
- Modify: `components/profile/ReportTabContent.tsx`

删除策略：软删除（`is_active = false`），数据保留；`ReportTabContent` 查询时已过滤 `is_active = true` 故删后自动消失。

- [ ] **Step 1: 创建软删除 API**

新建 `app/api/report-nodes/delete/route.ts`：

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createSessionClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const sessionClient = await createSessionClient()
    const { data: { user } } = await sessionClient.auth.getUser()
    if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })

    const { id } = await req.json()
    if (!id) return NextResponse.json({ error: '缺少 id' }, { status: 400 })

    const { error } = await sessionClient
      .from('report_nodes')
      .update({ is_active: false })
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = (e as { message?: string })?.message || String(e)
    console.error('[report-nodes/delete] error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
```

- [ ] **Step 2: 更新 ReportNodeTree.tsx — 新增 onDelete prop 和删除按钮**

`ReportNodeItemProps` 加 `onDelete: (node: ReportNode) => void`，在每个卡片右侧的按钮组加删除按钮（`编辑` 旁边），点击时弹 `window.confirm` 确认。

将 `ReportNodeItem` 签名改为：

```typescript
interface ReportNodeItemProps {
  node: ReportNode
  depth: number
  allNodes: ReportNode[]
  onEdit: (node: ReportNode) => void
  onDelete: (node: ReportNode) => void
}

function ReportNodeItem({ node, depth, allNodes, onEdit, onDelete }: ReportNodeItemProps) {
```

在卡片头部 `flex` 行，将原来只有"编辑"按钮改为按钮组：

```tsx
<div style={{ display: 'flex', gap: 6, flexShrink: 0, marginLeft: 8 }}>
  <button
    onClick={() => onEdit(node)}
    style={{
      fontSize: 11,
      color: '#6B6B6B',
      border: '1px solid #E8E4DD',
      borderRadius: 5,
      padding: '2px 8px',
      background: 'transparent',
      cursor: 'pointer',
    }}
  >
    编辑
  </button>
  <button
    onClick={() => {
      if (window.confirm(`确认删除「${node.name}」？此操作不可恢复。`)) {
        onDelete(node)
      }
    }}
    style={{
      fontSize: 11,
      color: '#D94F4F',
      border: '1px solid #F5C6C6',
      borderRadius: 5,
      padding: '2px 8px',
      background: 'transparent',
      cursor: 'pointer',
    }}
  >
    删除
  </button>
</div>
```

`ReportNodeTreeProps` 加 `onNodeDeleted: (id: string) => void`，`ReportNodeTree` 组件内实现 `handleDelete`：

```typescript
async function handleDelete(node: ReportNode) {
  const res = await fetch('/api/report-nodes/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: node.id }),
  })
  const data = await res.json()
  if (!data.error) {
    onNodeDeleted(node.id)
  }
}
```

在 tree 渲染中，所有 `<ReportNodeItem>` 都传入 `onDelete={handleDelete}`（包括递归子节点），同时递归 `ReportNodeItem` 渲染子节点时也要传 `onDelete`：

```tsx
{node.children?.map(child => (
  <ReportNodeItem
    key={child.id}
    node={child}
    depth={depth + 1}
    allNodes={allNodes}
    onEdit={onEdit}
    onDelete={onDelete}
  />
))}
```

- [ ] **Step 3: 更新 ReportTabContent.tsx — 处理删除回调**

加 `handleNodeDeleted`，传给 `ReportNodeTree`：

```typescript
function handleNodeDeleted(id: string) {
  setNodes(prev => {
    const updated = prev.filter(n => n.id !== id)
    onNodesChange?.(updated)
    return updated
  })
}
```

`ReportNodeTree` 调用改为：

```tsx
<ReportNodeTree
  nodes={nodes}
  onNodeSaved={handleNodeSaved}
  onNodeDeleted={handleNodeDeleted}
  onOpenAiPanel={onOpenAiPanel}
/>
```

- [ ] **Step 4: TypeScript 检查**

```bash
npx tsc --noEmit 2>&1
```

期望零报错。

- [ ] **Step 5: Commit**

```bash
git add app/api/report-nodes/delete/route.ts components/profile/ReportNodeTree.tsx components/profile/ReportTabContent.tsx
git commit -m "feat: add delete button to each report node card (soft delete)"
```

---

## 验收标准

1. 编辑 Modal 显示：汇报名称、汇报对象、汇报风格、包含模块（缺少：触发方式、汇报周期、依赖上层节点）
2. "包含模块"每条显示为竖向卡片，顶部 `### 标题` 输入行 + 下方描述 textarea
3. 保存节点后，Supabase `report_nodes` 表中 `style` 列有值，`trigger_desc`/`time_granularity`/`parent_id` 为 `NULL`
4. AI 对话中（profile 页面汇报框架 Tab）AI 会引导用户描述汇报重点、对象关注点、语气风格，且预览 JSON 不含旧字段
5. `npx tsc --noEmit` 零报错
