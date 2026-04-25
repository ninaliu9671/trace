# Task 05 · 职业画像三卡片

> 完成本 task 后再开始 task 06。
> 完成标准：职业画像 Tab 三个卡片可查看/编辑/保存，数据从 Supabase 读取并持久化，无 TS 报错。

---

## 前置要求

- Task 04 已完成并验收通过
- `UserProfile` 类型已在 `/types/index.ts` 定义
- `/lib/supabase/client.ts` 和 `/lib/supabase/server.ts` 已存在

---

## 这次要做什么

### 1. API Route：/api/profile/update

**创建 `app/api/profile/update/route.ts`**

接收部分字段，upsert 到 `user_profiles` 表：

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { createSessionClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

export async function POST(req: NextRequest) {
  try {
    const cookieStore = cookies()
    const sessionClient = createSessionClient(cookieStore)
    const { data: { user } } = await sessionClient.auth.getUser()
    if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })

    const body = await req.json()

    // 只允许更新这几个字段，防止越权
    const allowed = [
      'job_title', 'industry', 'work_years', 'company_size',
      'job_responsibilities', 'career_direction', 'skill_focus',
    ]
    const updates: Record<string, unknown> = { id: user.id }
    for (const key of allowed) {
      if (key in body) updates[key] = body[key]
    }

    const serverClient = createServerClient()
    const { error } = await serverClient
      .from('user_profiles')
      .upsert(updates)

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: '保存失败，请稍后重试' }, { status: 500 })
  }
}
```

---

### 2. ProfilePage：拉取 user_profiles 数据

**修改 `app/profile/page.tsx`**

在已有的 `useEffect`（检查新用户）里，顺带拉取 profile 数据并存入 state：

```typescript
const [profile, setProfile] = useState<UserProfile | null>(null)

// 在 checkNewUser useEffect 内，checkNewUser 函数末尾追加：
const { data: profileData } = await supabase
  .from('user_profiles')
  .select('*')
  .eq('id', user.id)
  .single()

setProfile(profileData)
```

将 `profile` 和 `setProfile` 传给职业画像 Tab 内容区（替换原来的占位 div）：

```typescript
{activeTab === 'profile' && (
  <ProfileTabContent
    profile={profile}
    onProfileUpdate={(updated) => setProfile(prev => prev ? { ...prev, ...updated } : null)}
  />
)}
```

---

### 3. ProfileTabContent 容器

**创建 `components/profile/ProfileTabContent.tsx`**

负责组织三个卡片的布局：

```typescript
import BasicInfoCard from './BasicInfoCard'
import ResponsibilitiesCard from './ResponsibilitiesCard'
import CareerDirectionCard from './CareerDirectionCard'
import { UserProfile } from '@/types'

interface ProfileTabContentProps {
  profile: UserProfile | null
  onProfileUpdate: (updated: Partial<UserProfile>) => void
}

export default function ProfileTabContent({ profile, onProfileUpdate }: ProfileTabContentProps) {
  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <BasicInfoCard profile={profile} onUpdate={onProfileUpdate} />
      <ResponsibilitiesCard profile={profile} onUpdate={onProfileUpdate} />
      <CareerDirectionCard profile={profile} onUpdate={onProfileUpdate} />
    </div>
  )
}
```

---

### 4. 卡片通用样式

所有卡片共用以下容器样式（可提取为 inline style 对象复用）：

```typescript
const cardStyle: React.CSSProperties = {
  background: '#FFFFFF',
  border: '1px solid #E8E4DD',
  borderRadius: 10,
  padding: '18px 20px',
}

// 卡片小标题（SECTION LABEL）
const sectionLabelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 500,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.5px',
  color: '#B0ADA6',
  marginBottom: 12,
}

// 空状态文字
const emptyTextStyle: React.CSSProperties = {
  fontSize: 13,
  color: '#B0ADA6',
  fontStyle: 'italic',
}
```

编辑按钮（右上角）：
```typescript
const editBtnStyle: React.CSSProperties = {
  fontSize: 12,
  color: '#6B6B6B',
  border: '1px solid #E8E4DD',
  borderRadius: 6,
  padding: '3px 10px',
  background: 'transparent',
  cursor: 'pointer',
}
```

保存/取消按钮：
```typescript
// 保存按钮
<button style={{
  fontSize: 12, fontWeight: 500,
  color: '#FFFFFF', background: '#1D9E75',
  border: 'none', borderRadius: 6,
  padding: '4px 12px', cursor: 'pointer',
}}>
  保存
</button>

// 取消按钮
<button style={{
  fontSize: 12,
  color: '#6B6B6B', background: 'transparent',
  border: '1px solid #E8E4DD', borderRadius: 6,
  padding: '4px 12px', cursor: 'pointer',
}}>
  取消
</button>
```

---

### 5. BasicInfoCard

**创建 `components/profile/BasicInfoCard.tsx`**

字段：职位 / 行业 / 工作年限 / 公司规模，无 AI 介入。

```typescript
'use client'
import { useState } from 'react'
import { UserProfile } from '@/types'

interface BasicInfoCardProps {
  profile: UserProfile | null
  onUpdate: (updated: Partial<UserProfile>) => void
}

export default function BasicInfoCard({ profile, onUpdate }: BasicInfoCardProps) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    job_title: profile?.job_title ?? '',
    industry: profile?.industry ?? '',
    work_years: profile?.work_years?.toString() ?? '',
    company_size: profile?.company_size ?? '',
  })

  // 进入编辑时用当前 profile 值初始化 form
  function handleEdit() {
    setForm({
      job_title: profile?.job_title ?? '',
      industry: profile?.industry ?? '',
      work_years: profile?.work_years?.toString() ?? '',
      company_size: profile?.company_size ?? '',
    })
    setEditing(true)
  }

  async function handleSave() {
    setSaving(true)
    const payload = {
      job_title: form.job_title || null,
      industry: form.industry || null,
      work_years: form.work_years ? parseInt(form.work_years) : null,
      company_size: form.company_size || null,
    }
    await fetch('/api/profile/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    onUpdate(payload)
    setSaving(false)
    setEditing(false)
  }

  // 字段列表
  const fields = [
    { key: 'job_title', label: '职位', placeholder: '如：产品经理' },
    { key: 'industry', label: '行业', placeholder: '如：互联网' },
    { key: 'work_years', label: '工作年限', placeholder: '如：3', type: 'number' },
    { key: 'company_size', label: '公司规模', placeholder: '如：500人以上' },
  ] as const

  return (
    <div style={cardStyle}>
      {/* 标题行 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <span style={sectionLabelStyle}>基本信息</span>
        {!editing && (
          <button style={editBtnStyle} onClick={handleEdit}>编辑</button>
        )}
      </div>

      {/* 展示态：2列网格 */}
      {!editing && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 24px' }}>
          {fields.map(f => (
            <div key={f.key}>
              <div style={{ fontSize: 11, color: '#B0ADA6', marginBottom: 3 }}>{f.label}</div>
              <div style={{ fontSize: 13, color: profile?.[f.key] ? '#1A1A1A' : '#B0ADA6', fontStyle: profile?.[f.key] ? 'normal' : 'italic' }}>
                {profile?.[f.key]?.toString() || '未填写'}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 编辑态：竖排输入框 */}
      {editing && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px', marginBottom: 16 }}>
            {fields.map(f => (
              <div key={f.key}>
                <label style={{ fontSize: 12, color: '#6B6B6B', display: 'block', marginBottom: 4 }}>{f.label}</label>
                <input
                  type={f.type ?? 'text'}
                  value={form[f.key]}
                  onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  style={{
                    width: '100%', padding: '7px 10px', fontSize: 13,
                    border: '1px solid #E8E4DD', borderRadius: 7, outline: 'none',
                    fontFamily: 'inherit',
                  }}
                />
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button style={cancelBtnStyle} onClick={() => setEditing(false)} disabled={saving}>取消</button>
            <button style={saveBtnStyle} onClick={handleSave} disabled={saving}>
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
```

> `cardStyle`、`sectionLabelStyle`、`editBtnStyle`、`saveBtnStyle`、`cancelBtnStyle` 定义在同文件顶部（参考第 4 节样式）。

---

### 6. ResponsibilitiesCard

**创建 `components/profile/ResponsibilitiesCard.tsx`**

字段：`job_responsibilities`，自由文字，空状态有特定提示文案。

```typescript
'use client'
import { useState } from 'react'
import { UserProfile } from '@/types'

interface ResponsibilitiesCardProps {
  profile: UserProfile | null
  onUpdate: (updated: Partial<UserProfile>) => void
}

export default function ResponsibilitiesCard({ profile, onUpdate }: ResponsibilitiesCardProps) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [value, setValue] = useState(profile?.job_responsibilities ?? '')

  function handleEdit() {
    setValue(profile?.job_responsibilities ?? '')
    setEditing(true)
  }

  async function handleSave() {
    setSaving(true)
    await fetch('/api/profile/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ job_responsibilities: value || null }),
    })
    onUpdate({ job_responsibilities: value || null })
    setSaving(false)
    setEditing(false)
  }

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <span style={sectionLabelStyle}>基本工作职责</span>
        {!editing && (
          <button style={editBtnStyle} onClick={handleEdit}>编辑</button>
        )}
      </div>

      {/* 展示态 */}
      {!editing && (
        profile?.job_responsibilities ? (
          <p style={{ fontSize: 13, color: '#1A1A1A', lineHeight: 1.7, margin: 0 }}>
            {profile.job_responsibilities}
          </p>
        ) : (
          <p style={{ fontSize: 13, color: '#B0ADA6', lineHeight: 1.7, margin: 0 }}>
            还没有填写工作职责。点击「编辑」手动填写，或通过 AI 助手帮你整理。
          </p>
        )
      )}

      {/* 编辑态 */}
      {editing && (
        <>
          <textarea
            value={value}
            onChange={e => setValue(e.target.value)}
            placeholder="描述你的日常工作职责，AI 可以帮你润色..."
            rows={5}
            style={{
              width: '100%', padding: '8px 10px', fontSize: 13,
              border: '1px solid #E8E4DD', borderRadius: 7, outline: 'none',
              fontFamily: 'inherit', lineHeight: 1.7, resize: 'vertical',
              marginBottom: 12,
            }}
          />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button style={cancelBtnStyle} onClick={() => setEditing(false)} disabled={saving}>取消</button>
            <button style={saveBtnStyle} onClick={handleSave} disabled={saving}>
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
```

---

### 7. CareerDirectionCard

**创建 `components/profile/CareerDirectionCard.tsx`**

字段：`career_direction`（目标描述）+ `skill_focus`（逗号分隔技能标签）。

展示态将 `skill_focus` 按逗号拆分渲染为标签 chip：

```typescript
'use client'
import { useState } from 'react'
import { UserProfile } from '@/types'

interface CareerDirectionCardProps {
  profile: UserProfile | null
  onUpdate: (updated: Partial<UserProfile>) => void
}

export default function CareerDirectionCard({ profile, onUpdate }: CareerDirectionCardProps) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [direction, setDirection] = useState(profile?.career_direction ?? '')
  const [skillFocus, setSkillFocus] = useState(profile?.skill_focus ?? '')

  function handleEdit() {
    setDirection(profile?.career_direction ?? '')
    setSkillFocus(profile?.skill_focus ?? '')
    setEditing(true)
  }

  async function handleSave() {
    setSaving(true)
    const payload = {
      career_direction: direction || null,
      skill_focus: skillFocus || null,
    }
    await fetch('/api/profile/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    onUpdate(payload)
    setSaving(false)
    setEditing(false)
  }

  const skills = (profile?.skill_focus ?? '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)

  const isEmpty = !profile?.career_direction && !profile?.skill_focus

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <span style={sectionLabelStyle}>职业方向</span>
          <span style={{ fontSize: 11, color: '#B0ADA6', marginLeft: 6 }}>选填</span>
        </div>
        {!editing && (
          <button style={editBtnStyle} onClick={handleEdit}>编辑</button>
        )}
      </div>

      {/* 展示态 */}
      {!editing && (
        isEmpty ? (
          <p style={emptyTextStyle}>还没有填写职业方向。</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {profile?.career_direction && (
              <div>
                <div style={{ fontSize: 11, color: '#B0ADA6', marginBottom: 4 }}>目标</div>
                <p style={{ fontSize: 13, color: '#1A1A1A', lineHeight: 1.7, margin: 0 }}>
                  {profile.career_direction}
                </p>
              </div>
            )}
            {skills.length > 0 && (
              <div>
                <div style={{ fontSize: 11, color: '#B0ADA6', marginBottom: 6 }}>技能重点</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {skills.map((skill, i) => (
                    <span key={i} style={{
                      fontSize: 12, color: '#1A1A1A',
                      background: '#F4F3F0', border: '1px solid #E8E4DD',
                      borderRadius: 5, padding: '2px 8px',
                    }}>
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      )}

      {/* 编辑态 */}
      {editing && (
        <>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, color: '#6B6B6B', display: 'block', marginBottom: 4 }}>
              目标描述
              <span style={{ color: '#B0ADA6', fontWeight: 400, marginLeft: 4 }}>
                （可以写短期 1–2 年、中期 3–5 年、长期 7 年以上）
              </span>
            </label>
            <textarea
              value={direction}
              onChange={e => setDirection(e.target.value)}
              placeholder="写下你的职业目标..."
              rows={3}
              style={{
                width: '100%', padding: '8px 10px', fontSize: 13,
                border: '1px solid #E8E4DD', borderRadius: 7, outline: 'none',
                fontFamily: 'inherit', lineHeight: 1.7, resize: 'vertical',
              }}
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, color: '#6B6B6B', display: 'block', marginBottom: 4 }}>
              技能重点
              <span style={{ color: '#B0ADA6', fontWeight: 400, marginLeft: 4 }}>（逗号分隔）</span>
            </label>
            <input
              value={skillFocus}
              onChange={e => setSkillFocus(e.target.value)}
              placeholder="如：数据分析, 产品设计, 跨部门协作"
              style={{
                width: '100%', padding: '7px 10px', fontSize: 13,
                border: '1px solid #E8E4DD', borderRadius: 7, outline: 'none',
                fontFamily: 'inherit',
              }}
            />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button style={cancelBtnStyle} onClick={() => setEditing(false)} disabled={saving}>取消</button>
            <button style={saveBtnStyle} onClick={handleSave} disabled={saving}>
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
```

---

### 8. 更新职业画像 Tab 的 onboarding 完成状态

Task 04 写入数据后，`onboardingDone` 变为 `true`，此时 `profile` state 还是 `null`（写入前拉到的数据）。需在 `handleOnboardingComplete` 末尾重新拉取 profile：

**修改 `app/profile/page.tsx`** 的 `handleOnboardingComplete`，在写入完成后追加：

```typescript
// 重新拉取 profile 数据
const { data: freshProfile } = await supabase
  .from('user_profiles')
  .select('*')
  .eq('id', user.id)
  .single()
setProfile(freshProfile)
```

---

## 不做什么

```
❌ 汇报框架 Tab 内容（task 06 做）
❌ 记录维度 Tab 内容（task 07 做）
❌ AI 助手针对职业画像的上下文接入（task 08 做）
❌ 输入框 focus 时的边框颜色变化（样式优化，后续统一处理）
❌ 表单验证（字段均为选填，不做强制校验）
```

---

## 完成标准

```
□ 职业画像 Tab 显示三个卡片，有正确分区标题
□ BasicInfoCard 展示态：有数据显示数据，无数据显示灰色斜体「未填写」
□ BasicInfoCard 编辑态：2列网格输入框，保存后数据更新且持久化
□ BasicInfoCard 点「取消」→ 不保存，回到展示态
□ ResponsibilitiesCard 空状态：显示完整引导提示文案
□ ResponsibilitiesCard 编辑态：textarea 可输入，保存后显示新内容
□ CareerDirectionCard 空状态：显示「还没有填写职业方向。」
□ CareerDirectionCard 展示态：技能标签以 chip 形式显示
□ CareerDirectionCard 编辑态：目标/技能两个输入域，技能框有逗号分隔提示
□ 三个卡片保存按钮有 loading 态「保存中...」
□ 数据刷新后 Onboarding 完成时卡片显示 AI 生成的内容（重新拉取 profile 后）
□ 无 TypeScript 报错
□ npm run dev 无报错
```

---

## 做完后告诉我

1. 做了哪些文件
2. 三个卡片的编辑/保存/取消流程是否正常
3. Onboarding 完成后卡片有没有显示 AI 写入的职业档案数据
4. 不要自动开始 task 06，等我验收

---

*Task 05 | 2026.04.24*
