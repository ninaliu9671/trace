# Trace MVP · 完整 Task 清单

> 版本：v1.0 | 2026.04.24
> 原则：每个 task 做完能独立运行，验收通过后再开始下一个。
> 执行顺序：严格按编号，不跳跃。

---

## 阶段零：基础搭建

### Task 00 · 登录 / 注册 + 认证逻辑
**文件：** `docs/tasks/00_Auth_登录注册.md` ✅ 已写

创建 `/login` 页面（邮箱+密码+Tab切换），接入 Supabase Auth，配置 `middleware.ts` 保护 `/profile`、`/log`、`/summary` 路由，根路由 `/` 按 session 状态跳转。

**完成标准：** 能注册/登录，登录后跳 `/profile`，未登录访问受保护路由跳回 `/login`。

---

### Task 01 · ProfilePage 基础框架 + 全局布局
**文件：** `docs/tasks/01_ProfilePage_框架.md` ✅ 已写

创建全局基础文件（`/lib/supabase/client.ts`、`/lib/supabase/server.ts`、`/lib/ai.ts`、`/lib/prompts.ts`、`/types/index.ts`），设置 `globals.css`、`layout.tsx`（DM Sans 字体），实现左侧 `Sidebar.tsx`，搭建 `/profile` 三 Tab 框架（内容区占位）。

**完成标准：** 访问 `/profile` 能看到侧边栏 + 三个可切换 Tab + 底部状态栏，无 TS 报错。

---

## 阶段一：职业档案 /profile

### Task 02 · OnboardingModal + 新用户判断逻辑
**文件：** `docs/tasks/02_OnboardingModal.md`

在 `/profile` 页面加入新用户判断（查 `user_profiles`、`report_nodes`、`dimensions` 三表是否为空），若为新用户自动弹出引导弹窗 `OnboardingModal.tsx`。弹窗含三个入口：「和 AI 一起填写」（关闭弹窗+打开 AI 面板）、「我自己来填」（关闭弹窗）、「稍后再说」/×（关闭+本次 session 不再弹）。

**完成标准：** 新用户进 `/profile` 自动弹窗，三个入口行为正确，老用户不弹。

---

### Task 03 · AiSidePanel 通用 AI 对话栏
**文件：** `docs/tasks/03_AiSidePanel.md`

实现 `AiSidePanel.tsx`（右侧滑出，280px，所有页面复用）。含：顶部标题栏（AI 助手 / 结束对话 / ×）、上下文说明绿色横幅、消息气泡列表（AI 消息 + 用户消息）、底部输入区。面板开/关时主内容区用 CSS transition 压缩。`结束对话` 按钮逻辑（有未采纳预览时弹提示）。`×` 收起但保留历史，导航跳转时清空。

**完成标准：** `/profile` 页面 AI 助手按钮可打开/关闭面板，能收发消息（接入 DeepSeek），Esc 收起，切页面清空历史。

---

### Task 04 · Onboarding AI 对话 + 数据写入
**文件：** `docs/tasks/04_OnboardingAI.md`

接入 Prompt 12.1（初始化对话），新用户打开 AI 面板后自动触发 AI 开场白，多轮对话后 AI 返回 `onboarding_result` JSON，解析并写入 Supabase（`user_profiles`、`report_nodes`、`dimensions` 三表）。写入成功后三个 Tab 刷新显示内容，底部出现「前往工作日志 →」。API Route：`POST /api/onboarding/chat`。

**完成标准：** 5–8 轮对话后 AI 生成数据并写入 Supabase，三 Tab 有内容，底部跳转按钮出现。

---

### Task 05 · BasicInfoCard + ResponsibilitiesCard + CareerDirectionCard
**文件：** `docs/tasks/05_ProfileCards_职业画像.md`

实现职业画像 Tab 的三个卡片：
- `BasicInfoCard.tsx`：职位/行业/工作年限/公司规模，右上角「编辑」切换输入态，无 AI 介入
- `ResponsibilitiesCard.tsx`：工作职责自由文字，空状态提示，编辑时变 textarea
- `CareerDirectionCard.tsx`：目标描述 + 技能标签，空状态提示

均从 Supabase 读取已有数据，保存调用 `POST /api/profile/update`。

**完成标准：** 职业画像 Tab 三个卡片可查看/编辑/保存，数据持久化到 Supabase。

---

### Task 06 · ReportNodeTree + ReportNodeEditor（汇报框架 Tab）
**文件：** `docs/tasks/06_ReportNodeTree.md`

实现汇报框架 Tab：
- 空状态虚线卡片（⚙ 图标 + 「让 AI 帮我设计」入口）
- `ReportNodeTree.tsx`：层级缩进 + 左侧竖线，每层显示名称/触发时机/汇报对象/包含模块，最底层绿色标注
- `ReportNodeEditor.tsx`：节点编辑表单（名称/触发方式/汇报对象/包含模块/依赖上层）
- 底部「+ 添加汇报层级」和每个节点的「编辑」按钮
- 修改保存调用 `POST /api/report-nodes/save`

**完成标准：** 汇报框架 Tab 能展示已有树形结构，能编辑节点，数据持久化。

---

### Task 07 · DimensionTree + DimensionNodeEditor（记录维度 Tab）
**文件：** `docs/tasks/07_DimensionTree.md`

实现记录维度 Tab：
- 空状态虚线卡片（◫ 图标 + 「让 AI 帮我设计」入口）
- `DimensionTree.tsx`：三级目录展示（名称 + 提示词），顶部「↑ 以上维度由汇报框架倒推而来」说明
- `DimensionNodeEditor.tsx`：节点编辑（名称/图标/提示词）
- 每个节点「编辑」「删除」，底部「+ 添加职能维度」
- 保存调用 `POST /api/dimensions/save`

**完成标准：** 记录维度 Tab 能展示三级树形结构，能编辑/删除节点，数据持久化。

---

### Task 08 · Profile AI 助手上下文接入（老用户）
**文件：** `docs/tasks/08_ProfileAI_老用户.md`

老用户进入 `/profile` 时 AI 助手按需手动打开，AI 开场白「你好！我已读取你的职业档案。你想调整什么？」根据当前 Tab 自动加载对应上下文（Prompt 12.5）。实现 Tab 切换时的对话保护逻辑（6.5 节三种情况弹窗）。接入 `POST /api/profile/ai-chat`。

**完成标准：** 老用户 AI 助手根据当前 Tab 加载对应上下文，Tab 切换有未完成对话时弹确认框。

---

## 阶段二：工作日志 /log

### Task 09 · LogPage 基础框架 + DateNav
**文件：** `docs/tasks/09_LogPage_框架.md`

实现 `/log` 页面两栏布局（左侧目录 162px + 右侧内容区），顶部日期导航 `DateNav.tsx`（左右箭头切换日期 + 中间点击弹日历浮层，日历上绿色小点标有记录日期），右上角 AI 助手按钮（复用 `AiSidePanel`），已保存横幅（绿色）。

**完成标准：** `/log` 页面布局正确，日期导航可切换，日历可弹出。

---

### Task 10 · DimensionDirectory + LogField（日志内容区）
**文件：** `docs/tasks/10_LogContent.md`

实现日志核心内容区：
- `DimensionDirectory.tsx`：左栏目录，从 Supabase 读取用户维度树，圆点状态指示（●/◐/○），active 节点绿色竖线
- `LogField.tsx`：单个字段，提示词在上方，输入框自动增高，手动填写/AI 填入两种左竖线样式，锁定态（已保存时 readonly）
- `LogContent.tsx`：右栏按一级维度分区展示所有字段
- 读取已有记录：`GET /api/log/[date]`

**完成标准：** 维度目录可展示，右侧输入框按维度分组，已有记录能正确显示。

---

### Task 11 · SaveButton + 保存/编辑状态管理
**文件：** `docs/tasks/11_LogSave.md`

实现日志保存逻辑：
- `SaveButton.tsx`：「💾 保存今日记录」→ 保存中（loading）→「✓ 已保存」→ 1.2s 后切回已保存横幅
- 今天有保存记录时：显示横幅 + 所有字段 readonly，点「编辑」解锁
- 历史日期无记录：直接可填写
- 历史日期有记录：同上编辑逻辑
- 保存调用 `POST /api/log/save`

**完成标准：** 保存流程完整（loading → 成功 → 横幅），编辑/锁定状态切换正确，数据持久化。

---

### Task 12 · Log AI 助手接入（日志整理 + 图片上传）
**文件：** `docs/tasks/12_LogAI.md`

接入日志 AI 助手（Prompt 12.2）：上下文自动读取当前日期所有已填字段（含未保存内容），AI 返回 `log_preview` JSON，前端展示预览卡片（归属维度 + 内容），用户「采纳，填入记录」→ 内容填入对应输入框（浅绿竖线样式）。支持图片上传（截图），AI OCR 识别后给出预览卡片。API Route：`POST /api/log/ai-chat`。

**完成标准：** AI 能接收用户描述并归类到对应维度字段，采纳后正确填入，图片上传 OCR 可用。

---

## 阶段三：汇报总结 /summary

### Task 13 · SummaryPage 框架 + SummaryList
**文件：** `docs/tasks/13_SummaryPage_框架.md`

实现 `/summary` 两栏布局（左侧列表 220px + 右侧内容区）：
- `SummaryList.tsx`：按月分组，每条显示草稿/定稿徽章、名称、时间范围、维度标签
- `SummaryListItem.tsx`：含「▸ 文档属性」折叠入口（浮层展示：时间范围/类型/维度/数据来源）
- 右侧无选中状态：居中显示「点击查看总结或新建」
- API Route：`GET /api/summary/list`

**完成标准：** 历史总结列表可展示，按月分组，文档属性浮层可打开。

---

### Task 14 · NewSummaryModal + 数据完整度检查
**文件：** `docs/tasks/14_NewSummaryModal.md`

实现「+ 新建」弹窗 `NewSummaryModal.tsx`（500px）：时间范围选择（本周/本月/本季度/自定义）、职能维度多选、报告类型选填、汇报框架模板检测提示。点击「生成总结」后先调 `POST /api/summary/check-completeness` 检查数据，有缺失时展示 `DataCompletenessAlert.tsx` 弹窗（可选「先去补写」或「直接生成」）。

**完成标准：** 弹窗各项可选择，数据完整度检查结果正确展示，两种操作路径均可走通。

---

### Task 15 · AI 生成总结 + Loading + 草稿展示
**文件：** `docs/tasks/15_SummaryGenerate.md`

实现总结生成流程：Loading 遮罩（转圈 + 每 900ms 换提示文字），调 `POST /api/summary/generate`（含数据抓取优先级逻辑 11.1 节），AI 生成 Markdown 草稿（Prompt 12.3）。生成后进入草稿查看状态，写入 Supabase `summaries` 表。

**完成标准：** 点「生成总结」→ Loading → 草稿展示，内容写入数据库，刷新后列表有新条目。

---

### Task 16 · MarkdownEditor + SummaryTopbar（操作栏）
**文件：** `docs/tasks/16_MarkdownEditor.md`

实现 Markdown 编辑器（`MarkdownEditor.tsx`）：编辑模式（JetBrains Mono 13px 原文）/ 预览模式（渲染后排版）切换，预览模式下渲染 `<!-- ai-guess -->` 为黄色竖线块、`<!-- placeholder -->` 为红色竖线块。`SummaryTopbar.tsx`：「↩ 恢复上版」（含确认弹窗 `RevertConfirm.tsx`）、编辑/预览切换按钮组、「✦ AI 助手」、「存为定稿」（点后变只读，按钮改为「重新编辑」）。

**完成标准：** 编辑/预览可切换，特殊注释正确渲染，恢复上版确认框可用，存为定稿后变只读。

---

### Task 17 · Summary AI 助手 + AiReplaceCard（局部替换）
**文件：** `docs/tasks/17_SummaryAI.md`

接入总结 AI 助手（Prompt 12.4）：读取当前编辑器内容，用户指定章节，AI 返回 `replace_suggestion` JSON，前端展示 `AiReplaceCard.tsx`（原文划线 + 替换内容 + 三个操作按钮）。采纳：只替换指定段落；复制：写入剪贴板；不替换：移除卡片。不做整篇重新生成。API Route：`POST /api/summary/ai-chat`。

**完成标准：** AI 能给出局部替换建议，采纳后只修改指定段落，复制/不替换行为正确。

---

## 汇总

| # | Task | 依赖 | 状态 |
|---|------|------|------|
| 00 | 登录/注册 + 认证 | — | 已有文档 |
| 01 | ProfilePage 框架 + 全局布局 | 00 | 已有文档 |
| 02 | OnboardingModal + 新用户判断 | 01 | 待写 |
| 03 | AiSidePanel 通用 AI 对话栏 | 01 | 待写 |
| 04 | Onboarding AI 对话 + 数据写入 | 02, 03 | 待写 |
| 05 | 职业画像三卡片 | 04 | 待写 |
| 06 | 汇报框架 Tab | 04 | 待写 |
| 07 | 记录维度 Tab | 04 | 待写 |
| 08 | Profile AI 助手（老用户上下文） | 03, 05, 06, 07 | 待写 |
| 09 | LogPage 框架 + DateNav | 07 | 待写 |
| 10 | 日志目录 + 内容字段 | 09 | 待写 |
| 11 | 日志保存/编辑状态 | 10 | 待写 |
| 12 | Log AI 助手 + 图片上传 | 11 | 待写 |
| 13 | SummaryPage 框架 + 列表 | 07 | 待写 |
| 14 | 新建弹窗 + 数据完整度检查 | 13 | 待写 |
| 15 | AI 生成总结 + Loading | 14 | 待写 |
| 16 | MarkdownEditor + 操作栏 | 15 | 待写 |
| 17 | Summary AI 助手 + 局部替换 | 16 | 待写 |

---

*tasklist v1.0 | 2026.04.24*
