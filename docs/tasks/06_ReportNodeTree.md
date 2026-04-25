# Task 06 · 汇报框架 Tab（ReportNodeTree + ReportNodeEditor）

> 完成本 task 后再开始 task 07。
> 完成标准：汇报框架 Tab 能展示树形结构，能编辑/新增节点，数据持久化到 Supabase，无 TS 报错。

---

## 前置要求

- Task 04 已完成并验收通过（report_nodes 表有数据）
- `ReportNode`、`ReportModule` 类型已在 `/types/index.ts` 定义

---

## 这次要做什么

### 1. 更新 ReportNode 类型

**修改 `/types/index.ts`**，给 `ReportNode` 加 `children` 字段（前端构建树时使用）：

```typescript
export interface ReportNode {
  id: string
  user_id: string
  name: string
  trigger_desc: string | null
  audience: string | null
  modules: ReportModule[]
  parent_id: string | null
  sort_order: number
  time_granularity: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annual' | null
  is_active: boolean
  children?: ReportNode[]   // 新增，前端树形结构用
}
```

---

### 2. API Route：/api/report-nodes/save

**创建 `app/api/report-nodes/save/route.ts`**

新增或更新单个节点：

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

    // 新增：无 id；更新：有 id
    if (body.id) {
      const { data, error } = await serverClient
        .from('report_nodes')
        .update({
          name: body.name,
          trigger_desc: body.trigger_desc ?? null,
          audience: body.audience ?? null,
          modules: body.modules ?? [],
          parent_id: body.parent_id ?? null,
          time_granularity: body.time_granularity ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', body.id)
        .eq('user_id', user.id)   // 防止越权
        .select()
        .single()
      if (error) throw error
      return NextResponse.json({ node: data })
    } else {
      const { data, error } = await serverClient
        .from('report_nodes')
        .insert({
          user_id: user.id,
          name: body.name,
          trigger_desc: body.trigger_desc ?? null,
          audience: body.audience ?? null,
          modules: body.modules ?? [],
          parent_id: body.parent_id ?? null,
          time_granularity: body.time_granularity ?? null,
          sort_order: body.sort_order ?? 0,
        })
        .select()
        .single()
      if (error) throw error
      return NextResponse.json({ node: data })
    }
  } catch {
    return NextResponse.json({ error: '保存失败，请稍后重试' }, { status: 500 })
  }
}
```

---

### 3. 工具函数：平铺数组 → 树结构

**在 `components/profile/ReportNodeTree.tsx` 文件顶部定义**（不单独建文件）：

```typescript
function buildTree(nodes: ReportNode[]): ReportNode[] {
  const map: Record<string, ReportNode> = {}
  const roots: ReportNode[] = []

  // 先建 id → node 映射
  for (const node of nodes) {
    map[node.id] = { ...node, children: [] }
  }

  // 再挂父子关系
  for (const node of Object.values(map)) {
    if (node.parent_id && map[node.parent_id]) {
      map[node.parent_id].children!.push(node)
    } else {
      roots.push(node)
    }
  }

  // 各层按 sort_order 排序
  function sortChildren(n: ReportNode) {
    n.children?.sort((a, b) => a.sort_order - b.sort_order)
    n.children?.forEach(sortChildren)
  }
  roots.sort((a, b) => a.sort_order - b.sort_order)
  roots.forEach(sortChildren)

  return roots
}
```

---

### 4. ReportTabContent 容器

**创建 `components/profile/ReportTabContent.tsx`**

拉取数据、管理节点状态、挂载子组件：

```typescript
'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ReportNode } from '@/types'
import ReportNodeTree from './ReportNodeTree'

export default function ReportTabContent() {
  const [nodes, setNodes] = useState<ReportNode[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchNodes() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('report_nodes')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('sort_order')

      setNodes(data ?? [])
      setLoading(false)
    }
    fetchNodes()
  }, [])

  function handleNodeSaved(savedNode: ReportNode) {
    setNodes(prev => {
      const exists = prev.find(n => n.id === savedNode.id)
      return exists
        ? prev.map(n => n.id === savedNode.id ? savedNode : n)
        : [...prev, savedNode]
    })
  }

  if (loading) return (
    <div style={{ padding: 24, color: '#B0ADA6', fontSize: 13 }}>加载中...</div>
  )

  return (
    <div style={{ padding: 24 }}>
      <ReportNodeTree
        nodes={nodes}
        onNodeSaved={handleNodeSaved}
      />
    </div>
  )
}
```

在 `app/profile/page.tsx` 中，将汇报框架 Tab 占位替换为：

```typescript
import ReportTabContent from '@/components/profile/ReportTabContent'

{activeTab === 'report' && <ReportTabContent />}
```

---

### 5. ReportNodeTree

**创建 `components/profile/ReportNodeTree.tsx`**

#### 空状态

```typescript
// nodes.length === 0 时显示
<div style={{
  border: '1.5px dashed #E8E4DD',
  borderRadius: 10,
  padding: '40px 24px',
  textAlign: 'center',
  color: '#B0ADA6',
}}>
  <div style={{ fontSize: 24, marginBottom: 12 }}>⚙</div>
  <div style={{ fontSize: 14, fontWeight: 500, color: '#6B6B6B', marginBottom: 6 }}>
    还没有设置汇报框架
  </div>
  <div style={{ fontSize: 13, color: '#B0ADA6', marginBottom: 20, lineHeight: 1.7 }}>
    先完成职业画像，AI 会帮你从年报倒推设计完整的汇报体系
  </div>
  <button
    onClick={() => {/* 触发父页面打开 AI 面板，暂时用 console.log 占位 */
      console.log('open AI panel')
    }}
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

树形节点递归渲染，每一层缩进 20px，左侧竖线：

```typescript
interface ReportNodeItemProps {
  node: ReportNode
  depth: number
  allNodes: ReportNode[]    // 编辑表单选父节点时用
  onEdit: (node: ReportNode) => void
}

function ReportNodeItem({ node, depth, allNodes, onEdit }: ReportNodeItemProps) {
  const isLeaf = !node.children || node.children.length === 0

  return (
    <div style={{ position: 'relative' }}>
      {/* 左侧竖线（非根节点） */}
      {depth > 0 && (
        <div style={{
          position: 'absolute',
          left: depth * 20 - 12,
          top: 0, bottom: 0,
          width: 1.5,
          background: '#E8E4DD',
        }} />
      )}

      {/* 节点卡片 */}
      <div
        style={{
          marginLeft: depth * 20,
          marginBottom: 8,
          padding: '12px 14px',
          background: isLeaf ? '#F0FBF7' : '#FAFAF8',
          border: `1px solid ${isLeaf ? '#9FE1CB' : '#E8E4DD'}`,
          borderRadius: 8,
        }}
      >
        {/* 标题行 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <span style={{
              fontSize: 13, fontWeight: 500,
              color: isLeaf ? '#0F6E56' : '#1A1A1A',
            }}>
              {node.name}
            </span>
            {node.trigger_desc && (
              <span style={{ fontSize: 12, color: '#B0ADA6', marginLeft: 8 }}>
                {node.trigger_desc}
              </span>
            )}
          </div>
          <button
            onClick={() => onEdit(node)}
            style={{
              fontSize: 11, color: '#6B6B6B',
              border: '1px solid #E8E4DD', borderRadius: 5,
              padding: '2px 8px', background: 'transparent',
              cursor: 'pointer', flexShrink: 0, marginLeft: 8,
            }}
          >
            编辑
          </button>
        </div>

        {/* 汇报对象 */}
        {node.audience && (
          <div style={{ fontSize: 12, color: '#6B6B6B', marginTop: 4 }}>
            汇报对象：{node.audience}
          </div>
        )}

        {/* 包含模块 */}
        {node.modules.length > 0 && (
          <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {node.modules.map(m => (
              <span key={m.id} style={{
                fontSize: 11, color: '#6B6B6B',
                background: '#F4F3F0', border: '1px solid #E8E4DD',
                borderRadius: 4, padding: '1px 6px',
              }} title={m.description}>
                {m.name}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* 子节点递归 */}
      {node.children?.map(child => (
        <ReportNodeItem
          key={child.id}
          node={child}
          depth={depth + 1}
          allNodes={allNodes}
          onEdit={onEdit}
        />
      ))}
    </div>
  )
}
```

#### ReportNodeTree 主体

```typescript
interface ReportNodeTreeProps {
  nodes: ReportNode[]
  onNodeSaved: (node: ReportNode) => void
}

export default function ReportNodeTree({ nodes, onNodeSaved }: ReportNodeTreeProps) {
  const [editingNode, setEditingNode] = useState<ReportNode | null>(null)
  const [showEditor, setShowEditor] = useState(false)

  const tree = buildTree(nodes)

  function handleEdit(node: ReportNode) {
    setEditingNode(node)
    setShowEditor(true)
  }

  function handleAddNew() {
    setEditingNode(null)
    setShowEditor(true)
  }

  return (
    <>
      {nodes.length === 0 ? (
        /* 空状态虚线卡片 */
      ) : (
        <>
          {tree.map(root => (
            <ReportNodeItem
              key={root.id}
              node={root}
              depth={0}
              allNodes={nodes}
              onEdit={handleEdit}
            />
          ))}

          {/* 底部说明 */}
          <div style={{
            marginTop: 16, padding: '10px 14px',
            background: '#FAFAF8', borderRadius: 7,
            fontSize: 12, color: '#B0ADA6',
            border: '1px solid #F0EDE8',
          }}>
            生成汇报总结时，系统优先调用时间段内已有的定稿报告，其次使用原始日志。
          </div>

          {/* 添加按钮 */}
          <button
            onClick={handleAddNew}
            style={{
              marginTop: 12, width: '100%', padding: '9px',
              border: '1.5px dashed #E8E4DD', borderRadius: 8,
              background: 'transparent', color: '#6B6B6B',
              fontSize: 13, cursor: 'pointer',
            }}
          >
            + 添加汇报层级
          </button>
        </>
      )}

      {/* 编辑弹窗 */}
      {showEditor && (
        <ReportNodeEditor
          node={editingNode}
          allNodes={nodes}
          onSaved={(saved) => {
            onNodeSaved(saved)
            setShowEditor(false)
          }}
          onClose={() => setShowEditor(false)}
        />
      )}
    </>
  )
}
```

---

### 6. ReportNodeEditor

**创建 `components/profile/ReportNodeEditor.tsx`**

弹窗形式，宽 480px，居中，blur 遮罩。

Props：
```typescript
interface ReportNodeEditorProps {
  node: ReportNode | null        // null = 新增模式
  allNodes: ReportNode[]         // 用于选择父节点
  onSaved: (node: ReportNode) => void
  onClose: () => void
}
```

表单字段：

| 字段 | 类型 | 说明 |
|---|---|---|
| 汇报名称 * | 文本输入 | 必填 |
| 触发方式 | 文本输入 | 如「每周五」|
| 汇报对象 | 文本输入 | 如「直属总监」|
| 汇报周期 | 下拉选择 | daily/weekly/monthly/quarterly/annual |
| 依赖上层节点 | 下拉选择 | 从 allNodes 选择（排除自身及其子孙） |
| 包含模块 | 动态列表 | 名称 + 描述，可增删 |

内部状态：

```typescript
const [form, setForm] = useState({
  name: node?.name ?? '',
  trigger_desc: node?.trigger_desc ?? '',
  audience: node?.audience ?? '',
  time_granularity: node?.time_granularity ?? '',
  parent_id: node?.parent_id ?? '',
})
const [modules, setModules] = useState<ReportModule[]>(
  node?.modules ?? []
)
const [saving, setSaving] = useState(false)
const [error, setError] = useState('')
```

包含模块动态列表：

```typescript
function addModule() {
  setModules(prev => [...prev, { id: Date.now().toString(), name: '', description: '' }])
}

function updateModule(id: string, field: 'name' | 'description', value: string) {
  setModules(prev => prev.map(m => m.id === id ? { ...m, [field]: value } : m))
}

function removeModule(id: string) {
  setModules(prev => prev.filter(m => m.id !== id))
}
```

模块列表渲染（每条一行：名称输入框 + 描述输入框 + 删除按钮）：

```typescript
{modules.map(m => (
  <div key={m.id} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
    <input
      value={m.name}
      onChange={e => updateModule(m.id, 'name', e.target.value)}
      placeholder="模块名称"
      style={{ width: 120, /* 输入框样式 */ }}
    />
    <input
      value={m.description}
      onChange={e => updateModule(m.id, 'description', e.target.value)}
      placeholder="简要描述"
      style={{ flex: 1, /* 输入框样式 */ }}
    />
    <button onClick={() => removeModule(m.id)} style={{ color: '#B0ADA6', /* 删除按钮 */ }}>×</button>
  </div>
))}
<button onClick={addModule} style={{ fontSize: 12, color: '#6B6B6B', /* 添加按钮 */ }}>
  + 添加模块
</button>
```

汇报周期下拉选项：

```typescript
const granularityOptions = [
  { value: '', label: '— 不设定 —' },
  { value: 'daily',     label: '每日' },
  { value: 'weekly',    label: '每周' },
  { value: 'monthly',   label: '每月' },
  { value: 'quarterly', label: '每季度' },
  { value: 'annual',    label: '每年' },
]
```

父节点下拉（排除自身）：

```typescript
const parentOptions = allNodes.filter(n => n.id !== node?.id)
```

保存函数：

```typescript
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
    trigger_desc: form.trigger_desc || null,
    audience: form.audience || null,
    time_granularity: form.time_granularity || null,
    parent_id: form.parent_id || null,
    modules: modules.filter(m => m.name.trim()),  // 过滤掉空名称的模块
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
```

弹窗底部按钮：

```typescript
<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 20 }}>
  <div style={{ fontSize: 12, color: '#D94F4F' }}>{error}</div>
  <div style={{ display: 'flex', gap: 8 }}>
    <button style={cancelBtnStyle} onClick={onClose} disabled={saving}>取消</button>
    <button style={saveBtnStyle} onClick={handleSave} disabled={saving}>
      {saving ? '保存中...' : '保存'}
    </button>
  </div>
</div>
```

Esc 关闭弹窗：

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
❌ 节点删除功能（is_active = false，后续加）
❌ 节点拖拽排序（MVP 不做）
❌ 记录维度 Tab（task 07 做）
❌ AI 助手针对汇报框架的上下文接入（task 08 做）
❌ 「让 AI 帮我设计」按钮真正触发 AI（task 08 做，现在 console.log 占位）
```

---

## 完成标准

```
□ 汇报框架 Tab 无数据时显示虚线空状态卡片（⚙ 图标 + 说明 + AI 按钮）
□ 有数据时显示树形结构，根节点在最外层，子节点缩进 + 左侧竖线
□ 叶节点（无子节点）有浅绿背景 + 深绿文字区分
□ 每个节点显示：名称 + 触发时机 + 汇报对象 + 包含模块 chip
□ 点「编辑」→ 弹出 ReportNodeEditor，字段预填当前节点数据
□ ReportNodeEditor 可修改名称/触发方式/汇报对象/周期/父节点/模块
□ 模块可动态添加/删除
□ 点「保存」→ 调 API → 树形列表更新，数据持久化到 Supabase
□ 点「取消」或 Esc → 弹窗关闭，数据不变
□ 点「+ 添加汇报层级」→ 弹出空白 ReportNodeEditor
□ 新增节点保存后出现在树形列表中
□ 汇报名称为空时显示错误提示，不提交
□ 底部有「生成汇报总结时...」说明文字
□ 无 TypeScript 报错
□ npm run dev 无报错
```

---

## 做完后告诉我

1. 做了哪些文件
2. 树形结构有没有正确按 parent_id 渲染层级
3. 新增/编辑节点后 Supabase 里数据是否正确
4. 不要自动开始 task 07，等我验收

---

*Task 06 | 2026.04.24*
