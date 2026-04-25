# Task 07 · 记录维度 Tab（DimensionTree + DimensionNodeEditor）

> 完成本 task 后再开始 task 08。
> 完成标准：记录维度 Tab 能展示三级树形结构，能编辑/删除节点，数据持久化到 Supabase，无 TS 报错。

---

## 前置要求

- Task 04 已完成并验收通过（dimensions 表有数据）
- `Dimension` 类型已在 `/types/index.ts` 定义
- `/lib/supabase/server.ts` 中两个 client 函数已存在

---

## 这次要做什么

### 1. 更新 Dimension 类型

**修改 `/types/index.ts`**，给 `Dimension` 加 `children` 字段：

```typescript
export interface Dimension {
  id: string
  user_id: string
  name: string
  icon: string
  level: 1 | 2 | 3
  parent_id: string | null
  sort_order: number
  prompt_text: string | null
  is_active: boolean
  children?: Dimension[]    // 新增，前端树形结构用
}
```

---

### 2. API Route：/api/dimensions/save

**创建 `app/api/dimensions/save/route.ts`**

新增或更新单个维度节点：

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createSessionClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

export async function POST(req: NextRequest) {
  try {
    const cookieStore = cookies()
    const sessionClient = createSessionClient(cookieStore)
    const { data: { user } } = await sessionClient.auth.getUser()
    if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })

    const body = await req.json()
    const serverClient = createServerClient()

    if (body.id) {
      const { data, error } = await serverClient
        .from('dimensions')
        .update({
          name: body.name,
          icon: body.icon ?? '📋',
          level: body.level,
          parent_id: body.parent_id ?? null,
          sort_order: body.sort_order ?? 0,
          prompt_text: body.level === 3 ? (body.prompt_text ?? null) : null,
        })
        .eq('id', body.id)
        .eq('user_id', user.id)
        .select()
        .single()
      if (error) throw error
      return NextResponse.json({ dimension: data })
    } else {
      const { data, error } = await serverClient
        .from('dimensions')
        .insert({
          user_id: user.id,
          name: body.name,
          icon: body.icon ?? '📋',
          level: body.level,
          parent_id: body.parent_id ?? null,
          sort_order: body.sort_order ?? 99,
          prompt_text: body.level === 3 ? (body.prompt_text ?? null) : null,
          is_active: true,
        })
        .select()
        .single()
      if (error) throw error
      return NextResponse.json({ dimension: data })
    }
  } catch {
    return NextResponse.json({ error: '保存失败，请稍后重试' }, { status: 500 })
  }
}
```

---

### 3. API Route：/api/dimensions/delete

**创建 `app/api/dimensions/delete/route.ts`**

软删除：将节点及其所有子孙节点的 `is_active` 设为 `false`。

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createSessionClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

export async function POST(req: NextRequest) {
  try {
    const cookieStore = cookies()
    const sessionClient = createSessionClient(cookieStore)
    const { data: { user } } = await sessionClient.auth.getUser()
    if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })

    const { id }: { id: string } = await req.json()
    const serverClient = createServerClient()

    // 收集要删除的所有节点 id（节点本身 + 所有子孙）
    const toDelete = new Set<string>([id])

    // 拉取该用户所有维度，在内存里找子孙
    const { data: allDims } = await serverClient
      .from('dimensions')
      .select('id, parent_id')
      .eq('user_id', user.id)
      .eq('is_active', true)

    function collectChildren(parentId: string) {
      for (const dim of allDims ?? []) {
        if (dim.parent_id === parentId && !toDelete.has(dim.id)) {
          toDelete.add(dim.id)
          collectChildren(dim.id)
        }
      }
    }
    collectChildren(id)

    const { error } = await serverClient
      .from('dimensions')
      .update({ is_active: false })
      .in('id', Array.from(toDelete))
      .eq('user_id', user.id)

    if (error) throw error
    return NextResponse.json({ deletedIds: Array.from(toDelete) })
  } catch {
    return NextResponse.json({ error: '删除失败，请稍后重试' }, { status: 500 })
  }
}
```

---

### 4. 工具函数：平铺数组 → 树结构

在 `components/profile/DimensionTree.tsx` 文件顶部定义（与 ReportNodeTree 同样的模式）：

```typescript
function buildDimensionTree(dims: Dimension[]): Dimension[] {
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

---

### 5. DimensionTabContent 容器

**创建 `components/profile/DimensionTabContent.tsx`**

```typescript
'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Dimension } from '@/types'
import DimensionTree from './DimensionTree'

export default function DimensionTabContent() {
  const [dimensions, setDimensions] = useState<Dimension[]>([])
  const [loading, setLoading] = useState(true)

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
      setLoading(false)
    }
    fetchDimensions()
  }, [])

  function handleDimensionSaved(saved: Dimension) {
    setDimensions(prev => {
      const exists = prev.find(d => d.id === saved.id)
      return exists
        ? prev.map(d => d.id === saved.id ? saved : d)
        : [...prev, saved]
    })
  }

  function handleDimensionDeleted(deletedIds: string[]) {
    setDimensions(prev => prev.filter(d => !deletedIds.includes(d.id)))
  }

  if (loading) return (
    <div style={{ padding: 24, color: '#B0ADA6', fontSize: 13 }}>加载中...</div>
  )

  return (
    <div style={{ padding: 24 }}>
      <DimensionTree
        dimensions={dimensions}
        onDimensionSaved={handleDimensionSaved}
        onDimensionDeleted={handleDimensionDeleted}
      />
    </div>
  )
}
```

在 `app/profile/page.tsx` 中，将记录维度 Tab 占位替换为：

```typescript
import DimensionTabContent from '@/components/profile/DimensionTabContent'

{activeTab === 'dimension' && <DimensionTabContent />}
```

---

### 6. DimensionTree

**创建 `components/profile/DimensionTree.tsx`**

#### 空状态

```typescript
// dimensions.length === 0 时显示
<div style={{
  border: '1.5px dashed #E8E4DD',
  borderRadius: 10,
  padding: '40px 24px',
  textAlign: 'center',
}}>
  <div style={{ fontSize: 24, marginBottom: 12 }}>◫</div>
  <div style={{ fontSize: 14, fontWeight: 500, color: '#6B6B6B', marginBottom: 6 }}>
    还没有设置记录维度
  </div>
  <div style={{ fontSize: 13, color: '#B0ADA6', marginBottom: 20, lineHeight: 1.7 }}>
    汇报框架设置完成后，AI 会自动倒推出你每天应该记录的维度
  </div>
  <button
    onClick={() => console.log('open AI panel')}
    style={{
      background: '#E8F7F2', color: '#0F6E56',
      border: '1px solid #9FE1CB', borderRadius: 7,
      padding: '7px 16px', fontSize: 13, cursor: 'pointer',
    }}
  >
    ✦ 让 AI 帮我设计
  </button>
</div>
```

#### 有内容状态

```typescript
interface DimensionTreeProps {
  dimensions: Dimension[]
  onDimensionSaved: (dim: Dimension) => void
  onDimensionDeleted: (ids: string[]) => void
}

export default function DimensionTree({ dimensions, onDimensionSaved, onDimensionDeleted }: DimensionTreeProps) {
  const [editingDim, setEditingDim] = useState<Dimension | null>(null)
  const [showEditor, setShowEditor] = useState(false)

  const tree = buildDimensionTree(dimensions)

  return (
    <>
      {dimensions.length === 0 ? (
        /* 空状态虚线卡片 */
      ) : (
        <>
          {/* 顶部关联说明 */}
          <div style={{
            padding: '8px 12px',
            background: '#F0FBF7',
            border: '1px solid #E8F7F2',
            borderRadius: 7,
            fontSize: 12,
            color: '#0F6E56',
            marginBottom: 16,
          }}>
            ↑ 以上维度由汇报框架倒推而来。AI 生成汇报总结时会按这些维度归类日志。
          </div>

          {/* 树形节点 */}
          {tree.map((root, i) => (
            <DimensionNodeItem
              key={root.id}
              node={root}
              number={`${i + 1}`}
              allDimensions={dimensions}
              onEdit={(dim) => { setEditingDim(dim); setShowEditor(true) }}
              onDeleted={onDimensionDeleted}
            />
          ))}

          {/* 底部添加按钮 */}
          <button
            onClick={() => { setEditingDim(null); setShowEditor(true) }}
            style={{
              marginTop: 12, width: '100%', padding: '9px',
              border: '1.5px dashed #E8E4DD', borderRadius: 8,
              background: 'transparent', color: '#6B6B6B',
              fontSize: 13, cursor: 'pointer',
            }}
          >
            + 添加职能维度
          </button>
        </>
      )}

      {showEditor && (
        <DimensionNodeEditor
          node={editingDim}
          allDimensions={dimensions}
          onSaved={(saved) => { onDimensionSaved(saved); setShowEditor(false) }}
          onClose={() => setShowEditor(false)}
        />
      )}
    </>
  )
}
```

#### DimensionNodeItem（递归）

```typescript
interface DimensionNodeItemProps {
  node: Dimension
  number: string               // 如 "1"、"1.1"、"1.1.2"
  allDimensions: Dimension[]
  onEdit: (dim: Dimension) => void
  onDeleted: (ids: string[]) => void
}

function DimensionNodeItem({ node, number, allDimensions, onEdit, onDeleted }: DimensionNodeItemProps) {
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    if (!confirm(`确认删除「${node.name}」及其所有子维度？`)) return
    setDeleting(true)
    try {
      const res = await fetch('/api/dimensions/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: node.id }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      onDeleted(data.deletedIds)
    } catch {
      alert('删除失败，请稍后重试')
    } finally {
      setDeleting(false)
    }
  }

  const isLeaf = node.level === 3

  // 节点行容器
  return (
    <div style={{ marginLeft: (node.level - 1) * 20, marginBottom: 4 }}>
      {/* 节点行 */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        padding: '8px 12px',
        borderRadius: 7,
        background: isLeaf ? '#F8FFFE' : 'transparent',
        border: isLeaf ? '1px solid #E8F7F2' : '1px solid transparent',
      }}
        onMouseEnter={e => {
          if (!isLeaf) (e.currentTarget as HTMLDivElement).style.background = '#FAFAF8'
        }}
        onMouseLeave={e => {
          if (!isLeaf) (e.currentTarget as HTMLDivElement).style.background = 'transparent'
        }}
      >
        {/* 序号 + 图标 + 名称 */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'flex-start', gap: 6 }}>
          <span style={{ fontSize: 12, color: '#B0ADA6', minWidth: 32, paddingTop: 1 }}>
            {number}
          </span>
          {node.level === 1 && (
            <span style={{ fontSize: 14, lineHeight: 1.4 }}>{node.icon}</span>
          )}
          <div>
            <span style={{
              fontSize: 13,
              fontWeight: node.level === 1 ? 500 : 400,
              color: '#1A1A1A',
            }}>
              {node.name}
            </span>
            {/* 叶节点显示提示词 */}
            {isLeaf && node.prompt_text && (
              <div style={{ fontSize: 12, color: '#6B6B6B', marginTop: 2, lineHeight: 1.6 }}>
                提示词：{node.prompt_text}
              </div>
            )}
          </div>
        </div>

        {/* 操作按钮（hover 显示） */}
        <div style={{ display: 'flex', gap: 6, flexShrink: 0, marginLeft: 8 }}>
          <button
            onClick={() => onEdit(node)}
            style={{
              fontSize: 11, color: '#6B6B6B',
              border: '1px solid #E8E4DD', borderRadius: 5,
              padding: '2px 8px', background: 'transparent', cursor: 'pointer',
            }}
          >
            编辑
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            style={{
              fontSize: 11,
              color: deleting ? '#B0ADA6' : '#D94F4F',
              border: '1px solid #F0EDE8', borderRadius: 5,
              padding: '2px 8px', background: 'transparent',
              cursor: deleting ? 'default' : 'pointer',
            }}
          >
            {deleting ? '...' : '删除'}
          </button>
        </div>
      </div>

      {/* 子节点递归 */}
      {node.children?.map((child, ci) => (
        <DimensionNodeItem
          key={child.id}
          node={child}
          number={`${number}.${ci + 1}`}
          allDimensions={allDimensions}
          onEdit={onEdit}
          onDeleted={onDeleted}
        />
      ))}
    </div>
  )
}
```

---

### 7. DimensionNodeEditor

**创建 `components/profile/DimensionNodeEditor.tsx`**

弹窗宽 440px，居中，blur 遮罩。

Props：

```typescript
interface DimensionNodeEditorProps {
  node: Dimension | null         // null = 新增
  allDimensions: Dimension[]     // 用于选父节点
  onSaved: (dim: Dimension) => void
  onClose: () => void
}
```

表单字段：

| 字段 | 类型 | 说明 |
|---|---|---|
| 维度名称 * | 文本输入 | 必填 |
| 图标 | 文本输入 | emoji，默认 📋 |
| 层级 * | 下拉 | 1/2/3，影响是否显示「父节点」和「提示词」|
| 父节点 | 下拉 | level 2 必须选一级父节点，level 3 必须选二级父节点 |
| 提示词 | textarea | 仅 level 3 显示 |

内部状态：

```typescript
const [form, setForm] = useState({
  name: node?.name ?? '',
  icon: node?.icon ?? '📋',
  level: node?.level ?? 1,
  parent_id: node?.parent_id ?? '',
  prompt_text: node?.prompt_text ?? '',
})
const [saving, setSaving] = useState(false)
const [error, setError] = useState('')
```

层级切换时自动清空父节点（因为不同层级对应不同的父节点候选列表）：

```typescript
function handleLevelChange(newLevel: number) {
  setForm(prev => ({ ...prev, level: newLevel as 1|2|3, parent_id: '' }))
}
```

父节点候选列表（按层级过滤）：

```typescript
// level 2 → 候选是 level 1 的节点
// level 3 → 候选是 level 2 的节点
const parentOptions = allDimensions.filter(d => {
  if (form.level === 2) return d.level === 1
  if (form.level === 3) return d.level === 2
  return false
}).filter(d => d.id !== node?.id)
```

父节点下拉（level 1 时隐藏）：

```typescript
{form.level > 1 && (
  <div style={{ marginBottom: 14 }}>
    <label style={labelStyle}>
      父节点 {form.level > 1 ? '*' : ''}
    </label>
    <select
      value={form.parent_id}
      onChange={e => setForm(prev => ({ ...prev, parent_id: e.target.value }))}
      style={inputStyle}
    >
      <option value="">— 选择父节点 —</option>
      {parentOptions.map(p => (
        <option key={p.id} value={p.id}>{p.icon} {p.name}</option>
      ))}
    </select>
  </div>
)}
```

提示词 textarea（仅 level 3）：

```typescript
{form.level === 3 && (
  <div style={{ marginBottom: 14 }}>
    <label style={labelStyle}>
      提示词
      <span style={{ color: '#B0ADA6', fontWeight: 400, marginLeft: 4 }}>
        （每日记录时显示在输入框上方）
      </span>
    </label>
    <textarea
      value={form.prompt_text}
      onChange={e => setForm(prev => ({ ...prev, prompt_text: e.target.value }))}
      placeholder="如：今天在需求侧做了什么？推进到哪了？"
      rows={2}
      style={{ ...inputStyle, resize: 'vertical' }}
    />
  </div>
)}
```

保存函数：

```typescript
async function handleSave() {
  if (!form.name.trim()) { setError('维度名称不能为空'); return }
  if (form.level > 1 && !form.parent_id) { setError('请选择父节点'); return }

  setSaving(true)
  setError('')

  const payload = {
    ...(node?.id ? { id: node.id } : {}),
    name: form.name.trim(),
    icon: form.icon || '📋',
    level: form.level,
    parent_id: form.parent_id || null,
    prompt_text: form.level === 3 ? (form.prompt_text || null) : null,
    sort_order: node?.sort_order ?? 99,
  }

  try {
    const res = await fetch('/api/dimensions/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    if (data.error) throw new Error(data.error)
    onSaved(data.dimension)
  } catch (e) {
    setError((e as Error).message || '保存失败，请稍后重试')
  } finally {
    setSaving(false)
  }
}
```

Esc 关闭：

```typescript
useEffect(() => {
  function handleKey(e: KeyboardEvent) {
    if (e.key === 'Escape') onClose()
  }
  window.addEventListener('keydown', handleKey)
  return () => window.removeEventListener('keydown', handleKey)
}, [onClose])
```

---

## 不做什么

```
❌ 节点拖拽排序（MVP 不做）
❌ 确认删除改用专属 confirm 弹窗（用浏览器原生 confirm() 即可）
❌ 超过三级的嵌套（spec 限定最多三级）
❌ AI 助手针对记录维度的上下文接入（task 08 做）
❌ 「让 AI 帮我设计」按钮真正触发 AI（task 08 做，现在 console.log 占位）
❌ /log 页面对维度数据的读取（task 10 做）
```

---

## 完成标准

```
□ 记录维度 Tab 无数据时显示虚线空状态卡片（◫ 图标 + 说明 + AI 按钮）
□ 有数据时顶部显示绿色关联说明横幅
□ 树形结构正确按三级渲染，序号格式「1 / 1.1 / 1.1.1」
□ 一级节点显示 icon，三级节点显示浅绿背景 + 提示词
□ 每个节点有「编辑」「删除」按钮
□ 点「编辑」→ 弹出 DimensionNodeEditor，字段预填当前数据
□ 点「删除」→ 浏览器 confirm 确认 → 节点及子节点从列表移除，Supabase 软删除
□ DimensionNodeEditor 层级选 1 时隐藏父节点选择和提示词
□ 层级选 2 时显示父节点下拉（候选仅一级节点），隐藏提示词
□ 层级选 3 时显示父节点下拉（候选仅二级节点）+ 提示词 textarea
□ 层级切换时父节点自动清空
□ 名称为空 / level>1 未选父节点 → 显示错误提示，不提交
□ 点「+ 添加职能维度」→ 弹出空白 DimensionNodeEditor
□ 新增节点保存后出现在树形列表中
□ 无 TypeScript 报错
□ npm run dev 无报错
```

---

## 做完后告诉我

1. 做了哪些文件
2. 三级树形结构序号有没有正确显示
3. 删除节点后子孙节点是否一并消失（Supabase 中 is_active 是否都变为 false）
4. 不要自动开始 task 08，等我验收

---

*Task 07 | 2026.04.24*
