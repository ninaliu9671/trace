# Profile AI Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复职业档案 AI 面板的三个问题：① 汇报框架/记录维度采纳后不写入数据库；② 提示词改为一次性引导收集 + 为犹豫用户提供选项；③ 新增文件上传按钮（支持 .txt）。

**Architecture:** Task 1 修复 Supabase session 客户端（加 setAll），解决 API Route 中的认证问题。Task 2 同步更新 `lib/prompts.ts` 的对话策略和 `profile/page.tsx` 的硬编码初始消息。Task 3 在 `AiSidePanel.tsx` 中添加 📎 按钮和文件读取逻辑，不引入新依赖。

**Tech Stack:** TypeScript, Next.js 15 App Router, @supabase/ssr v0.10.2, React

---

## 文件结构

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `lib/supabase/server.ts` | Modify | 给 `createSessionClient` 加 `setAll`，修复 Route Handler 中 token 刷新 |
| `lib/prompts.ts` | Modify | 修改 `profile_advisor` 职业画像收集策略：一次性引导 + 犹豫选项 |
| `app/profile/page.tsx` | Modify | 更新 `buildInitialMessage()` 与新 prompt 策略保持一致 |
| `components/AiSidePanel.tsx` | Modify | 加文件上传按钮 + 文本文件内容读取逻辑 |

---

### Task 1：修复 `createSessionClient` — 加 `setAll`

**根本原因：** `@supabase/ssr` v0.10.2 在 Next.js Route Handler 中，如果 `setAll` 未定义，token 刷新操作会静默失败，导致 API Route 读取到过期 session，`auth.getUser()` 返回空，所有后续写入 401 失败。

**Files:**
- Modify: `lib/supabase/server.ts`

- [ ] **Step 1: 读取当前文件**

  读 `lib/supabase/server.ts`（当前内容）：
  ```typescript
  export async function createSessionClient(cookieMethods?: SessionCookies) {
    const cookieStore = await cookies()
    return createSupabaseSessionClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: cookieMethods ?? {
          getAll: () => cookieStore.getAll(),
        },
      }
    )
  }
  ```

- [ ] **Step 2: 在 `createSessionClient` 的 cookies 对象中加入 `setAll`**

  将 `createSessionClient` 函数替换为：
  ```typescript
  export async function createSessionClient(cookieMethods?: SessionCookies) {
    const cookieStore = await cookies()

    return createSupabaseSessionClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: cookieMethods ?? {
          getAll: () => cookieStore.getAll(),
          setAll: (cookiesToSet) => {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              )
            } catch {
              // 在 Server Component 中调用时忽略，不影响 Route Handler
            }
          },
        },
      }
    )
  }
  ```

- [ ] **Step 3: 在 `report-nodes/save` 和 `dimensions/save` 路由加 console.error 日志**

  在 `app/api/report-nodes/save/route.ts` 的 catch 块，改为：
  ```typescript
  } catch (e) {
    const msg = (e as { message?: string })?.message || String(e)
    console.error('[report-nodes/save] error:', msg, e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
  ```

  在 `app/api/dimensions/save/route.ts` 的 catch 块，改为：
  ```typescript
  } catch (e) {
    const msg = (e as { message?: string })?.message || String(e)
    console.error('[dimensions/save] error:', msg, e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
  ```

  同样在两个路由的 `auth.getUser()` 检查后加日志（便于确认 session 是否被读到）：
  ```typescript
  // report-nodes/save/route.ts 和 dimensions/save/route.ts，在 if (!user) return ... 前加：
  if (!user) {
    console.error('[route] no user in session - cookies may not be forwarded')
    return NextResponse.json({ error: '未登录' }, { status: 401 })
  }
  ```

- [ ] **Step 4: Commit**

  ```bash
  git add lib/supabase/server.ts app/api/report-nodes/save/route.ts app/api/dimensions/save/route.ts
  git commit -m "fix: add setAll to createSessionClient and add error logging to save routes"
  ```

---

### Task 2：更新 prompt 对话策略 + 同步初始消息

**Files:**
- Modify: `lib/prompts.ts` (职业画像 `▸ 职业画像` 段落内的对话策略)
- Modify: `app/profile/page.tsx` (函数 `buildInitialMessage`)

#### 2A. 更新 `lib/prompts.ts` 职业画像对话策略

当前 `▸ 职业画像` 对话策略是分步收集（每次问 1-2 个字段）。用户想要：**先用一个开放性问题让用户一次性描述，再对缺失字段追问；对说不清楚的用户主动给选项。**

- [ ] **Step 1: 找到目标文本**

  在 `lib/prompts.ts` 中，找到以下文本（在 `▸ 职业画像` 部分）：

  ```
    对话策略：
    - 每次只问一个问题，口语化
    - 已有内容的字段跳过，不重复询问

    【如果用户上传了文件/图片】
  ```

- [ ] **Step 2: 将整段对话策略替换**

  用以下内容替换（从 `对话策略：` 到 `收集完毕后生成预览` 之前的整段）：

  ```
    对话策略：
    - 已有内容的字段跳过，不重复询问
    - 用一个开放性问题邀请用户一次性描述，不分步问：
      「能简单介绍一下你的工作吗？职位、行业、大概做了几年、主要负责什么——
      一起说都行，不用很完整，我来帮你整理。」
    - 用户回应后，提取所有能推断的字段，对已理解的部分做简短确认，
      再只追问真正缺失的必须字段（职业/行业、工作年限、核心职责），一次最多 2 个

    【如果用户表示不知道怎么说，或回答过于模糊（如"普通白领""就是工作"）】
    主动给出 3-4 个具体方向选项，例如：
    「没关系，我给你几个参考方向，哪个最接近你？
    A. 产品/项目经理——负责需求分析、版本迭代或项目推进
    B. 销售/客户经理——维护客户关系、推进合同或业绩达成
    C. 技术研发（前端/后端/算法）——写代码、做功能、解 bug
    D. 市场/运营——策划推广、做内容或拉新留存
    如果都不像，直接告诉我你的职位名称也行，我来帮你展开。」
    根据用户选择继续深入，不要再让用户从头描述。

    【如果用户上传了文件/图片】
  ```

  注意：其余部分（文件解析路径、判断条件、JSON 输出格式）保持不变。

- [ ] **Step 3: Commit**

  ```bash
  git add lib/prompts.ts
  git commit -m "feat: change profile_advisor to upfront collection + options for reluctant users"
  ```

#### 2B. 更新 `app/profile/page.tsx` 中的 `buildInitialMessage`

`buildInitialMessage()` 的新用户分支硬编码了旧的引导文本，需要与 prompt 保持一致（邀请一次性描述工作）。

- [ ] **Step 4: 找到并替换新用户分支的初始消息**

  当前：
  ```typescript
  if (isNewUser) {
    return '你好！我来帮你建立职业档案。我们需要完成三个部分：职业画像、汇报框架、记录维度。\n我会逐步问你，你来回答，确认后内容会直接保存到对应页面。\n我们先从职业画像开始，可以吗？'
  }
  ```

  替换为：
  ```typescript
  if (isNewUser) {
    return '你好！我来帮你建立一套专属的职业档案。\n\n完成后你会得到：\n• 一份职业画像\n• 一套汇报框架\n• 一个日志维度模板\n\n先从你的工作开始——能简单介绍一下吗？职位、行业、做了几年、主要负责什么，一起说都行，我来整理。'
  }
  ```

- [ ] **Step 5: Commit**

  ```bash
  git add app/profile/page.tsx
  git commit -m "feat: update buildInitialMessage to match new prompt strategy"
  ```

---

### Task 3：AiSidePanel 新增文件上传按钮

支持 `.txt` 文本文件（无需新依赖）。用户选择文件后，文件内容以 `[文件：filename]\n内容...` 的形式拼入下一条消息。

**Files:**
- Modify: `components/AiSidePanel.tsx`

- [ ] **Step 1: 在 state 和 ref 声明区加入 file 相关状态**

  在 `AiSidePanel` 函数体内，在现有 `const [sending, setSending] = useState(false)` 后面加：
  ```typescript
  const [attachedFileText, setAttachedFileText] = useState<string | null>(null)
  const [attachedFileName, setAttachedFileName] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  ```

- [ ] **Step 2: 在 `handleSend` 函数开头，将附件内容拼入消息文本**

  找到 `handleSend` 函数的第一行：
  ```typescript
  const text = input.trim()
  if (!text || inputLocked) return
  ```

  替换为：
  ```typescript
  const rawText = input.trim()
  const filePrefix = attachedFileText
    ? `[文件：${attachedFileName}]\n${attachedFileText}\n\n`
    : ''
  const text = filePrefix + rawText
  if (!text.trim() || inputLocked) return
  // 发送后清除附件
  setAttachedFileText(null)
  setAttachedFileName(null)
  ```

- [ ] **Step 3: 添加文件选择处理函数**

  在 `handleDiscard` 函数后面、`return` 语句之前，加入：
  ```typescript
  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    // 只支持文本文件
    if (!file.type.startsWith('text/') && !file.name.endsWith('.txt')) {
      alert('目前只支持上传 .txt 文本文件')
      e.target.value = ''
      return
    }
    const reader = new FileReader()
    reader.onload = (ev) => {
      const content = ev.target?.result as string
      setAttachedFileText(content)
      setAttachedFileName(file.name)
    }
    reader.readAsText(file, 'utf-8')
    e.target.value = '' // 允许重复选同一文件
  }
  ```

- [ ] **Step 4: 在输入区渲染附件提示 + 📎 按钮**

  找到 `{/* 输入区 */}` 下方的 `<div style={{ display: 'flex', gap: 8 }}>` (包含 textarea 和发送按钮的 flex 行)。

  在它**前面**插入附件名称提示（有附件时显示）：
  ```tsx
  {attachedFileName && (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      fontSize: 12,
      color: '#0F6E56',
      background: '#F0FBF7',
      border: '1px solid #9FE1CB',
      borderRadius: 6,
      padding: '4px 8px',
    }}>
      📎 {attachedFileName}
      <button
        onClick={() => { setAttachedFileText(null); setAttachedFileName(null) }}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B6B6B', fontSize: 13, lineHeight: 1 }}
      >
        ×
      </button>
    </div>
  )}
  ```

  在 textarea **之前**插入 📎 按钮：
  ```tsx
  {/* 隐藏的 file input */}
  <input
    ref={fileInputRef}
    type="file"
    accept=".txt,text/plain"
    style={{ display: 'none' }}
    onChange={handleFileSelect}
    disabled={inputLocked}
  />
  <button
    type="button"
    onClick={() => fileInputRef.current?.click()}
    disabled={inputLocked}
    title="上传文本文件"
    style={{
      width: 32,
      height: 32,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'transparent',
      border: '1px solid #E8E4DD',
      borderRadius: 7,
      cursor: inputLocked ? 'not-allowed' : 'pointer',
      color: inputLocked ? '#B0ADA6' : '#6B6B6B',
      fontSize: 15,
      flexShrink: 0,
    }}
  >
    📎
  </button>
  ```

  修改后输入区 flex 行顺序为：`[file input (hidden)] [📎 button] [textarea] [发送 button]`

- [ ] **Step 5: 修改发送按钮的 disabled 条件，附件存在时也允许发送**

  找到：
  ```tsx
  disabled={!input.trim() || inputLocked}
  ```
  替换为：
  ```tsx
  disabled={(!input.trim() && !attachedFileText) || inputLocked}
  ```

  同样，`handleSend` 的输入校验已在 Step 2 中改为 `if (!text.trim() || inputLocked)`，可以正确处理"只有附件没有文字"的情况。

- [ ] **Step 6: Commit**

  ```bash
  git add components/AiSidePanel.tsx
  git commit -m "feat: add txt file upload to AiSidePanel"
  ```

---

## 自检清单

- [ ] **Spec 覆盖**
  - 汇报框架/记录维度保存 → Task 1 修复 session client
  - prompt 一次性引导 → Task 2A
  - 犹豫用户给选项 → Task 2A
  - 初始消息与 prompt 一致 → Task 2B
  - 文件上传入口 → Task 3

- [ ] **类型一致**
  - `attachedFileText: string | null`，`text` 拼接后类型为 `string` ✓
  - `fileInputRef: RefObject<HTMLInputElement>` ✓

- [ ] **不引入新依赖** — 三个 Task 均只修改现有文件，未 npm install ✓

- [ ] **JSON 输出格式不变** — Task 2A 只改对话策略段落，不触碰 JSON 格式行 ✓
