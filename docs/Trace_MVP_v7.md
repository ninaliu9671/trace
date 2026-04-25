# Trace 履迹 · MVP 开发文档
> 版本：v7.0 | 2026.04.25
> 技术栈：Next.js 14 (App Router) + Tailwind CSS + Supabase + DeepSeek API
> 原则：每一步做完必须能独立运行，不堆功能，不自由发挥

---

## 一、产品定位（一句话）

**Trace 帮职场人随手记录每天的工作，AI 整理成随时可用的汇报总结。**

用户每天花 2–5 分钟按模板记录，到写周报月报述职的时候，AI 直接生成草稿。

---

## 二、MVP 核心假设

> 用户通过和 AI 对话搭建一套记录框架，按这个框架每天记录之后，AI 能生成让他满意的工作总结。

验证这两件事，MVP 就成功了。

---

## 三、MVP 功能边界

### ✅ 做

```
模块零：登录 / 注册（/login）
  - 邮箱 + 密码注册（无需邮件验证）
  - 邮箱 + 密码登录
  - 邮箱唯一性校验（重复注册提示）
  - 密码一致性校验（注册时）
  - 登录/注册成功后跳转 /profile
  - middleware 保护 /profile、/log、/summary

模块一：职业档案（/profile）【登录后的第一个落地页】
  - 新用户进入时弹出引导弹窗（onboarding 逻辑集成在此）
  - Tab 1 职业画像：基本信息 / 工作职责 / 职业方向
  - Tab 2 汇报框架：周期型层级结构，用户自定义
  - Tab 3 记录维度：多层级目录，最小层级是每日提示词
  - 空状态有专属引导（虚线卡片 + 说明 + AI 入口）
  - 统一 AI 助手入口（右上角，右侧滑出对话栏）

模块二：工作日志（/log）
  - 两栏布局：左侧目录 | 右侧内容区（提示词在输入框上方）
  - 顶部左右箭头切换日期 + 点中间弹日历
  - 已保存记录锁定展示，点「编辑」解锁
  - 保存到数据库
  - 统一 AI 助手入口（右上角，右侧滑出对话栏）

模块三：汇报总结（/summary）
  - 左侧历史列表 + 右侧内容区
  - 新建总结：弹窗选参数（时间范围 / 职能维度 / 报告类型）
  - AI 生成 Markdown 草稿
  - 编辑模式 / 预览模式切换
  - AI 局部替换建议（用户确认才替换）
  - 恢复上一保存版本
  - 存为定稿
  - 统一 AI 助手入口（右上角，右侧滑出对话栏）
```

### ❌ 不做（后期加）

```
❌ 忘记密码 / 第三方登录
❌ 项目型汇报 / 日志打项目标签
❌ 矩阵视图
❌ 日常记录追问弹窗
❌ 简历素材库
❌ OKR 目标管理
❌ 数据图表可视化
❌ 语音输入 / 文件上传（log AI 助手只支持图片）
❌ 付费订阅 / 数据导出
❌ 移动端 App（先做 Web）
```

---

## 四、页面路由

```
/                   → 服务端检查 session
                      有 session → 跳转 /profile
                      无 session → 跳转 /login

/login              → 登录 / 注册页面（Tab 切换）
                      已登录用户访问 → 跳转 /profile

/profile            → 职业档案（三个 Tab）
                      新用户：自动弹出引导弹窗
                      老用户：直接展示已有内容

/log                → 工作日志（默认今天）
/log/[date]         → 指定日期日志页

/summary            → 汇报总结列表 + 内容区
/summary/[id]       → 单份总结详情（可选，也可在同页展示）
```

**路由保护（middleware.ts）：**
未登录用户访问 /profile、/log、/summary 时自动跳转 /login。

**注意：没有独立的 /onboarding 路由。**
Onboarding 逻辑完全集成在 /profile 页面里，通过检测数据是否为空来判断新老用户。

---

## 五、界面设计规范

### 5.1 视觉风格

**定位：** 安静、专业，像一本高质量工作手册。不活泼，不社交。

**参考：** Notion 的克制 + Linear 的精准 + 一点点温度

### 5.2 颜色系统

```
页面背景：    #F8F7F4（米白，像纸张）
侧边栏背景：  #EDEAE4（深一点的米色）
列表面板背景：#FAFAF8
主文字：      #1A1A1A
次要文字：    #6B6B6B
辅助文字：    #B0ADA6
边框：        #E8E4DD
分割线：      #F0EDE8

品牌绿：      #1D9E75（按钮、激活态、强调）
浅绿背景：    #E8F7F2（AI 按钮背景）
绿色边框：    #9FE1CB
深绿文字：    #0F6E56
深绿背景：    #F0FBF7

警告黄背景：  #FFFBEB（AI 推测标注）
警告黄边框：  #FDE68A
警告黄文字：  #92400E

错误红背景：  #FFF0F0（占位符）
错误红边框：  #F87171
错误红文字：  #B91C1C

AI 消息背景： #F8F7F4
用户消息背景：#1A1A1A / 文字 #FFFFFF

已保存横幅：  #F0FBF7 背景 / #9FE1CB 边框 / #0F6E56 文字
```

### 5.3 字体

```
中文：system-ui（苹方 / 微软雅黑）
英文数字：DM Sans（Google Fonts）
代码 / Markdown 编辑器：JetBrains Mono

字号：
  页面标题：    15–18px / 500
  卡片小标题：  11px / 500，全大写，letter-spacing: 0.5px，#B0ADA6
  正文：        13–14px / 400 / 行高 1.7
  辅助说明：    12px / 400
  极小标签：    10–11px
  按钮：        12–13px / 500
```

### 5.4 间距与圆角

```
页面内边距：  18–24px
卡片内边距：  14–18px
卡片圆角：    9–12px
按钮圆角：    6–8px
输入框圆角：  7–8px
标签圆角：    4–6px
```

### 5.5 全局布局

```
┌────────────┬──────────────────────────┬─────────────────┐
│ 左侧边栏   │ 主内容区（flex-1）        │ AI 面板（280px） │
│ 172px      │                          │ 按需从右侧滑出   │
│            │                          │                 │
│ Logo       │ 各页面内容               │ AI 对话区       │
│            │                          │                 │
│ ◉ 职业档案●│                          │                 │
│ ✦ 工作日志 │                          │                 │
│ ◫ 汇报总结 │                          │                 │
│            │                          │                 │
│ [头像]用户名│                          │                 │
└────────────┴──────────────────────────┴─────────────────┘
```

**导航顺序与名称（固定）：**
```
第一项：职业档案（/profile）  图标：◉
第二项：工作日志（/log）      图标：✦
第三项：汇报总结（/summary）  图标：◫
```

**导航状态指示：**
- 职业档案未完善时：名称右侧显示橙色小圆点（● #F59E0B）提醒用户完善
- 档案完善后：小圆点消失

**侧边栏样式：**
- 背景 #EDEAE4
- 导航激活：#1D9E75 背景，白色文字
- 导航 hover：#E4E0D8 背景
- Logo：「Trace」黑色，「履迹」绿色（#1D9E75）

---

## 六、AI 助手交互规范（全局统一）

### 6.1 入口设计

```
所有页面右上角统一一个「✦ AI 助手」按钮
样式：浅绿背景 + 绿色边框，激活时变深绿色实心
点击 → 右侧滑出 AI 对话栏（宽度 280px）
主内容区同步压缩（CSS transition 过渡）
```

**职业档案页说明：**
三个 Tab 共享同一个 AI 助手。AI 始终读取三个 Tab 的全部内容，不随 Tab 切换而切换上下文。入口统一在右上角同一个按钮。

### 6.2 AI 面板结构

```
┌─────────────────────────────┐
│ ✦ AI 助手   [结束对话] [×] │  ← 顶部标题栏
├─────────────────────────────┤
│ 已读取：职业画像 · 汇报框架 · 记录维度  │  ← 上下文说明（绿色背景）
├─────────────────────────────┤
│                             │
│  AI 消息气泡                │
│                 用户消息    │
│  AI 消息气泡                │
│                             │  ← 消息区（可滚动）
├─────────────────────────────┤
│ [文字输入框]        [发送]  │  ← 输入区（生成预览时锁定）
└─────────────────────────────┘
```

**「结束对话」按钮：**
- 位置：顶部标题栏，× 左侧
- 样式：小号灰色文字按钮 + 浅色边框
- 对话为空时：隐藏
- 点击时：若有未采纳预览 → 弹提示「有未采纳内容，结束后将丢失」→ [先采纳] [放弃并结束]；无未采纳内容 → 直接结束
- 结束后：对话末尾显示「— 本轮对话已结束 —」分隔线，按钮变灰禁用，面板保持展开

**× 关闭按钮：**
- 收起面板，不清空对话历史（session 内保留）

**输入框锁定态（仅 /profile）：**
- 当 AI 生成了某部分的内容预览后，输入框进入锁定态
- 锁定时输入框显示「请先对上方内容做选择」，发送按钮禁用
- 用户点「采纳，写入档案」或「放弃，重新讨论」后，输入框解锁

### 6.3 上下文加载规则

```
/profile（任意 Tab）→ 读取：职业画像（基本信息 + 工作职责 + 职业方向）
                           + 汇报框架（完整汇报节点树）
                           + 记录维度（完整维度树结构）
                      三 Tab 全部内容一次性加载，不随 Tab 切换而变化

/log                → 读取：当前日期所有已填字段（包含未保存的编辑中内容）
/summary · 某份总结 → 读取：该总结 Markdown 编辑器当前内容（不强制先保存）
```

### 6.4 收起 / 关闭触发方式

```
① 点击 × 按钮          → 收起面板，保留对话历史
② 再次点击「AI 助手」   → 收起面板，保留对话历史
③ 按 Esc 键            → 收起面板，保留对话历史
④ 点击左侧导航跳转页面  → 自动收起，对话历史清空（跨页面不保留）
```

### 6.5 /profile 内 Tab 切换时的处理逻辑

由于对话历史不属于某个 Tab，切换 Tab 不清空对话。规则如下：

```
情况 A：AI 对话为空 / 已点击「结束对话」
  → 直接切换，不提示

情况 B：对话进行中，有未采纳的预览卡片
  → 弹提示：「有未采纳的 AI 生成内容，切换 Tab 后预览卡片将关闭，但对话历史保留。」
  → [先处理]  [继续切换]

情况 C：对话进行中，无未采纳预览（纯对话状态）
  → 直接切换，不提示，对话历史保留
```

注意：切换 Tab 永远不清空对话历史。只有跳转到其他页面（/log、/summary）时才清空。

### 6.6 会话存储规则

```
存数据库（永久）：
  用户点「采纳，写入档案」后的字段内容（/profile）
  用户点「保存」后的字段内容（/log）
  用户点「存为定稿」后的总结内容（/summary）

存 session 内存（关闭页面 / 退出登录即消失）：
  AI 对话历史
  未采纳的预览卡片内容

不存任何地方：
  被「放弃」的 AI 预览
  被「结束对话」清除的历史
```

### 6.7 各页面 AI 行为说明

**日常记录 /log：**
- 用户可随便描述今天做了什么，AI 自动判断归到哪个维度字段
- 用户也可以在对话中指定：「这条放到项目管理那里」
- AI 给出整理结果预览卡片（显示：归属维度 + 整理后内容）
- 用户点「采纳，填入记录」→ 内容填入对应输入框
- 已填入的字段用**浅绿色左竖线**标注（区别于手动填写的深绿色）
- 支持上传图片（截图），AI OCR 识别后提取内容
- 不支持文件上传（MVP 阶段）

**工作总结 /summary：**
- AI 读取当前 Markdown 编辑器内容（不需要先保存）
- 用户告诉 AI 想改哪个章节，AI 返回局部替换建议
- 替换建议格式：原文划线显示 + 新内容 + [采纳替换] [复制] [不替换]
- 采纳替换：只替换指定段落，其他内容不动
- 复制：用户自己决定粘贴到哪里
- 不做整篇重新生成（避免改动过大）

**职业档案 /profile：**
- AI 是统一的职业顾问角色，始终读取三个 Tab 的全部内容
- 新用户：先介绍整体流程，再逐步引导完成职业画像 → 汇报框架 → 记录维度
- 老用户：读取现有内容，用选择题让用户选择要调整哪个部分
- 每个部分：通过多轮对话收集信息 → 生成内容预览 → 输入框锁定 → 用户采纳/放弃
- 采纳或放弃后，AI 主动衔接，询问接下来处理哪个部分
- 不论处理哪个部分，对话上下文始终包含三个 Tab 的全量信息

---

## 七、职业档案模块（/profile）

### 7.0 新用户 Onboarding 逻辑（集成在此页面）

**没有独立的 /onboarding 页面。** 新用户引导完全在 /profile 内完成。

**判断新用户的条件：**
```
user_profiles 表中 job_title IS NULL
AND report_nodes 表中该用户无记录
AND dimensions 表中该用户无记录
→ 判定为新用户，触发引导弹窗
```

**引导弹窗设计（420px 宽，居中，背景 blur 遮罩）：**
```
┌─────────────────────────────────────────┐
│                                     [×] │
│  👋                                     │
│  欢迎使用 Trace 履迹                     │
│                                         │
│  在开始记录之前，先花 3 分钟              │
│  建立你的职业档案。AI 会根据你的情况，    │
│  设计一套专属的记录框架。                │
│                                         │
│  [1] 告诉 AI 你的职业背景               │
│  [2] AI 帮你设计汇报框架                │
│  [3] 确认后开始每日记录                 │
│                                         │
│  [✦ 和 AI 一起填写]  ← 绿色主按钮       │
│  [我自己来填]        ← 灰色次按钮       │
│  稍后再说            ← 文字链接         │
└─────────────────────────────────────────┘
```

**三个入口行为：**
```
「✦ 和 AI 一起填写」：
  关闭弹窗 + 自动打开右侧 AI 助手
  AI 开场白（新用户）：
  「你好！我来帮你建立职业档案。我们需要完成三个部分：
   职业画像、汇报框架、记录维度。
   我会逐步问你，你来回答，确认后内容会直接保存到对应页面。
   我们先从职业画像开始，可以吗？」
   → 等用户确认后，进入职业画像对话阶段

「我自己来填」：
  关闭弹窗，profile 正常展示，用户手动填
  AI 助手仍在右上角，用户随时可点
  用户手动点开 AI 助手时，触发与老用户相同的开场逻辑

「稍后再说」或 ×：
  关闭弹窗，本次 session 不再弹出
  导航栏「职业档案」旁保留橙色小圆点
```

**老用户进入 /profile：**
- 不弹弹窗，直接展示已有内容
- AI 不自动打开，用户主动点才开
- AI 开场白（老用户）：
  「你好！我已读取你的完整职业档案，包括职业画像、汇报框架和记录维度。
   你今天想调整哪个部分？
   A. 职业画像　B. 汇报框架　C. 记录维度」
  → 用户点选后，进入对应部分的对话，逻辑与新用户的对应阶段相同

**完成引导后：**
三个 Tab 都有内容后，底部状态栏出现：
```
✓ 职业档案已建立  [前往工作日志，开始今天的第一条记录 →]
```

### 7.1 整体结构

```
顶部：
  左：「职业档案」标题 + 副标题「你的记录框架与汇报体系」
  右：「✦ AI 助手」按钮

Tab 切换：职业画像 | 汇报框架 | 记录维度
  Tab 名称左侧有填写状态圆点：
  ● 深绿（已填写）  ○ 灰色（未填写）

底部状态栏：
  左：状态文字（「档案尚未完善」或「上次更新：时间」）
  右：状态标签（橙色「● 待完善」或绿色「✓ 已保存」）
```

### 7.2 Tab 1：职业画像

#### 区块 A：基本信息

字段：职位 / 行业 / 工作年限 / 公司规模

- 空状态：灰色斜体「未填写」
- 右上角「编辑」→ 输入框，出现「取消」「保存」
- **无 AI 介入**（客观事实字段）

#### 区块 B：基本工作职责

字段：自由文字段落

- 空状态提示：「还没有填写工作职责。点击「编辑」手动填写，或通过 AI 助手帮你整理。」
- 编辑态：文字变 textarea
- AI 助手可帮润色表达和结构化，不改变事实

#### 区块 C：职业方向（选填）

字段：
- 目标描述（引导语：「可以写短期 1–2 年、中期 3–5 年、长期 7 年以上」）
- 技能重点（逗号分隔标签）

- 空状态：灰色斜体「还没有填写职业方向。」
- AI 有专业主动性：只有短期目标时引导设中长期；只有长期目标时帮拆短期行动

### 7.3 Tab 2：汇报框架

**空状态（新用户）：**
```
虚线卡片，居中：
  ⚙
  还没有设置汇报框架
  先完成职业画像，AI 会帮你从年报倒推设计完整的汇报体系
  [✦ 让 AI 帮我设计]
```

**有内容状态：**

从年报倒推到日志的完整层级链，每层展示：
- 汇报名称 + 触发时机
- 汇报对象
- 包含模块（句子描述）

层级用缩进 + 左侧竖线，最底层「日志记录思路」绿色标注

操作：每个节点「编辑」按钮，底部「+ 添加汇报层级」

节点编辑表单：
```
汇报名称 / 触发方式 / 汇报对象 / 包含模块 / 依赖上层节点
```

页面底部说明：
> 「生成汇报总结时，系统优先调用时间段内已有的定稿报告，其次使用原始日志。」

### 7.4 Tab 3：记录维度

**空状态（新用户）：**
```
虚线卡片，居中：
  ◫
  还没有设置记录维度
  汇报框架设置完成后，AI 会自动倒推出你每天应该记录的维度
  [✦ 让 AI 帮我设计]
```

**有内容状态：**

多层级目录，支持三级：
```
1. 需求分析
  1.1 日常需求
    1.1.1 今日进展    提示词：今天在需求侧做了什么？
    1.1.2 争议决策    提示词：有没有需求争议？
```

操作：每个节点「编辑」「删除」，底部「+ 添加职能维度」

顶部关联说明：
> 「↑ 以上维度由汇报框架倒推而来。AI 生成汇报总结时会按这些维度归类日志。」

---

## 八、工作日志模块（/log）

### 8.1 页面布局

```
顶部栏：
  左：「工作日志」标题
  右：[‹] [2026年4月24日 周五 ▾] [›]  +  [✦ AI 助手]

已保存横幅（今天有记录时显示）：
  ✓ 本日记录已保存 · 2026.04.24 18:32        [编辑]

主区域（两栏）：
┌──────────────────┬────────────────────────────────────┐
│ 左栏：目录        │ 右栏：内容区                        │
│ 162px            │ flex-1                             │
│                  │                                    │
│ 📋 需求分析  ●   │ ── 需求分析 ──                     │
│   ▸ 今日进展 ●   │                                    │
│   ▸ 争议决策     │  1.1.1 今日进展                    │
│   ▸ 评审情况     │  今天在需求侧做了什么？...           │
│                  │  [输入框]                          │
│ 🗂 项目管理  ◐   │                                    │
│   ▸ 今日进展 ●   │  1.1.2 争议决策                    │
│   ▸ 当前阻塞     │  有没有需求争议...                  │
│   ▸ 关键决策     │  [输入框]                          │
│                  │                                    │
│ 👥 跨部门协作    │  ── 项目管理 ──                    │
│   ▸ 今日协作     │  ...                               │
│   ▸ 沟通难点     │                                    │
└──────────────────┴────────────────────────────────────┘

底部固定（编辑态才显示）：
  [💾 保存今日记录]（全宽按钮）
```

### 8.2 日期选择器

- 左右箭头：切换前后一天
- 点击中间日期区域：弹出日历浮层
- 日历上有绿色小点标记有记录的日期
- 今天：显示绿色圆点在日期左侧

### 8.3 已保存 / 编辑状态

```
默认态（今天已有保存记录）：
  - 顶部显示绿色已保存横幅
  - 所有输入框锁定（readonly），背景 #F8F7F4
  - 不显示底部保存按钮
  - 点「编辑」→ 解锁所有输入框，显示底部保存按钮，隐藏横幅

历史日期（无记录）：
  - 无横幅，输入框可直接填写
  - 显示底部保存按钮

历史日期（有记录）：
  - 同默认态，点「编辑」解锁
```

### 8.4 输入框详细设计

```
提示词位置：在输入框上方，11px 灰色文字，序号 + 提示内容
输入框最小高度：68–80px，随内容自动增高
placeholder：提示词的简短版本

状态样式：
  未填写：边框 #E8E4DD，背景 #FFFFFF
  填写中（focus）：边框 #1D9E75
  已填写（手动）：左边 2.5px 深绿竖线，背景 #FDFFFE
  已填写（AI 填入）：左边 2.5px 浅绿竖线，背景 #F8FFFE，边框 #C5EAE0
  锁定态：背景 #F8F7F4，边框 #F0EDE8，cursor: default
```

### 8.5 目录栏状态指示

```
维度旁的圆点：
  ●  深绿（所有字段已填）
  ◐  浅绿（部分字段已填）
  ○  灰色（未填）

子节点：
  active（当前查看）：绿色左竖线 + 绿色文字 + 浅绿背景
  已填写：文字颜色加深
  未填写：灰色文字
```

### 8.6 保存按钮状态

```
默认：#1A1A1A 背景，「💾 保存今日记录」
保存中：#6B6B6B 背景，loading 动画，「保存中...」
保存成功：#1D9E75 背景，「✓ 已保存」，1.2s 后切回已保存横幅，底部按钮消失
```

### 8.7 AI 助手在 /log 的行为

- 右上角「✦ AI 助手」按钮打开对话栏
- 上下文：自动读取当前日期所有已填字段（包含未保存的编辑中内容）
- 用户自由描述今天工作，AI 自动判断归维度字段
- 用户也可以指定：「这条放到项目管理」
- AI 给出预览卡片：[归属维度标签] + [整理后内容]
- 用户采纳 → 填入对应输入框（AI 填入样式：浅绿竖线）
- 支持上传图片（截图），AI 提取内容后给出预览
- 图片显示在输入框上方，36×36px 缩略图，可删除

---

## 九、汇报总结模块（/summary）

### 9.1 页面布局

```
┌──────────────────────┬────────────────────────────────────┐
│ 左侧列表（220px）     │ 右侧主内容区                        │
│                      │                                    │
│ 工作总结  [+ 新建]   │ 顶部：文档标题 + meta 标签          │
│                      │ 操作栏：[↩恢复] [编辑|预览] [AI] [存为定稿]│
│ ── 2026年4月 ──      │                                    │
│ [草稿] 本周周报       │ 内容区：Markdown 编辑器 / 预览      │
│   4月21–24日         │                                    │
│   需求 · 项目         │                                    │
│   ▸ 文档属性         │                                    │
│                      │                                    │
│ [定稿] 3月月报        │                                    │
│   ...                │                                    │
│                      │                                    │
│ ── 2026年3月 ──      │                                    │
│ [定稿] Q1季度复盘     │                                    │
│   ...                │                                    │
└──────────────────────┴────────────────────────────────────┘
```

**无选中状态（默认）：**
右侧主内容区居中显示：
```
[文档图标]
点击左侧列表查看总结
或点击「+ 新建」创建新的工作总结
```

### 9.2 左侧列表设计

每条总结显示：
- 草稿/定稿徽章（草稿：浅黄色；定稿：浅绿色）
- 总结名称
- 时间范围
- 职能维度标签（2–3 个，超出折叠）
- 「▸ 文档属性」折叠入口

**文档属性展开（浮层，点击其他地方关闭）：**
```
时间范围：___
报告类型：___
职能维度：___
汇报框架：已套用（模板名称）/ 未套用（自由生成）
数据来源：X 篇定稿报告 + Y 条日志
```

### 9.3 新建总结弹窗

点击「+ 新建」→ 弹出 500px 宽弹窗：

```
┌─────────────────────────────────────────────┐
│ 新建工作总结                              [×] │
├─────────────────────────────────────────────┤
│ 时间范围 *                                   │
│ [本周] [本月] [本季度] [自定义]              │
│ [日期输入框] 至 [日期输入框]                 │
│                                             │
│ 职能维度 *                                   │
│ [📋需求分析✓] [🗂项目管理✓] [👥跨部门] [📈数据]│
│                                             │
│ 报告类型（可选）                             │
│ [周报] [月报] [季报] [年报/述职] [临时汇报]  │
│                                             │
│ ┌─ 检测到汇报框架模板 ─────────────────────┐ │
│ │ ✦ 将套用「总监周报模板」生成         不套用│ │
│ └───────────────────────────────────────────┘│
├─────────────────────────────────────────────┤
│                         [取消]  [生成总结]   │
└─────────────────────────────────────────────┘
```

### 9.4 生成流程

**步骤 1：点击「生成总结」**
→ 关闭弹窗
→ 后端先查数据完整度

**步骤 2：数据完整度提示（如有缺失）**
```
┌─────────────────────────────────────────┐
│ 数据准备情况                             │
│                                         │
│ ✓ 找到 3 篇月报定稿（1月、3月、7月）    │
│ ✗ 季报缺失（将用月报 + 日志补充）       │
│ ✓ 找到 247 条日志记录                  │
│                                         │
│ [先去补写]              [直接生成]       │
└─────────────────────────────────────────┘
```

数据完整时跳过此步，直接进入生成。

**步骤 3：Loading 遮罩**
```
[转圈动画]
AI 正在读取你的 4 条工作日志...
（每 900ms 换一条提示文字）
```

**步骤 4：草稿展示**
生成完成后直接进入草稿查看状态。

### 9.5 文档顶部操作栏

```
左侧：文档标题 + meta 标签（时间范围 / 维度 / 报告类型）
右侧：[↩ 恢复上版] [编辑 | 预览] [✦ AI 助手] [存为定稿]
```

**「↩ 恢复上版」：**
- 点击弹确认框：「恢复到上一个保存版本？当前未保存的修改将丢失。」
- [取消] [确认恢复（红色按钮）]
- 仅在有保存历史时显示

**编辑 / 预览切换：**
- 两个按钮组，激活态黑底白字
- 编辑：Markdown 原文（JetBrains Mono，13px）
- 预览：渲染后的排版

**「存为定稿」：**
- 点击后按钮变绿色「✓ 已定稿」
- 定稿后文档变只读，想修改需点「重新编辑」（定稿后按钮变为此文字）

### 9.6 Markdown 内容规范

AI 生成的 Markdown 草稿中，特殊内容用注释标记：

```markdown
<!-- ai-guess: 这里是 AI 推测的内容 -->
<!-- placeholder: 请补充：缺少什么信息 -->
```

**预览模式下的渲染样式：**

AI 推测标注：
```
黄色左竖线块（border-left: 2.5px solid #F59E0B）
背景 #FFFBEB，前缀「✦ AI 推测 · 」
```

占位符：
```
红色左竖线块（border-left: 2.5px solid #F87171）
背景 #FFF0F0，前缀「⚠ 请补充：」
点击进入编辑模式
```

### 9.7 AI 助手在 /summary 的行为

- 读取：编辑器当前内容（不需要先保存）
- 用户说想改哪个章节，AI 返回**局部替换建议卡片**
- 替换建议格式（显示在预览区对应位置）：

```
┌─ ✦ AI 建议替换 · 「需求分析」第二段 ───────────┐
│ 原文：（删除线样式显示）                          │
│ 替换为：（正常文字）                              │
│                                                   │
│ [✓ 采纳替换]  [复制]  [不替换]                   │
└───────────────────────────────────────────────────┘
```

- 采纳：只替换指定段落，其他不动
- 复制：用户自己粘贴
- 不替换：卡片消失
- **不做整篇重新生成**

---

## 十、数据库设计（Supabase）

按顺序在 SQL Editor 执行：

```sql
-- 1. 用户档案
create table user_profiles (
  id uuid references auth.users(id) primary key,
  created_at timestamptz default now(),
  job_title text,
  industry text,
  work_years int,
  company_size text,
  job_responsibilities text,       -- 基本工作职责
  career_direction text,           -- 职业方向（自由文字）
  skill_focus text,                -- 技能重点（逗号分隔）
  onboarding_completed boolean default false
);

-- 2. 汇报节点（树状结构，parent_id 表达层级）
create table report_nodes (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  name text not null,
  trigger_desc text,               -- 「每周五」「每年12月」
  audience text,                   -- 「直属总监」
  modules jsonb default '[]',
  -- modules 格式：[{"id":"m1","name":"核心贡献","description":"..."}]
  parent_id uuid references report_nodes(id),
  sort_order int default 0,
  time_granularity text,           -- 'daily'|'weekly'|'monthly'|'quarterly'|'annual'
  is_active boolean default true
);

-- 3. 记录维度（多层级，最小层级有提示词）
create table dimensions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) not null,
  created_at timestamptz default now(),
  name text not null,
  icon text default '📋',
  level int default 1,             -- 1=一级，2=二级，3=最小层级（叶节点）
  parent_id uuid references dimensions(id),
  sort_order int default 0,
  prompt_text text,                -- 只有 level=3 的叶节点有值
  is_active boolean default true
);

-- 4. 日志（核心数据源，只增不改）
create table daily_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  log_date date not null default current_date,
  dimension_id uuid references dimensions(id) not null,  -- 对应最小层级维度
  content text not null,
  word_count int,                  -- 前端计算后存入
  is_ai_generated boolean default false  -- 是否由 AI 助手填入
);

-- 5. 工作总结
create table summaries (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  date_from date not null,
  date_to date not null,
  summary_type text not null,      -- 'weekly'|'monthly'|'quarterly'|'annual'|'adhoc'
  title text,
  content text not null,           -- Markdown 格式
  report_node_id uuid references report_nodes(id),  -- 套用的汇报框架节点
  data_sources jsonb default '{}',
  -- {"summaries_used":["id1"],"logs_count":47,"completeness":"partial"}
  is_draft boolean default true,
  finalized_at timestamptz
);

-- RLS
alter table user_profiles enable row level security;
alter table report_nodes enable row level security;
alter table dimensions enable row level security;
alter table daily_logs enable row level security;
alter table summaries enable row level security;

create policy "own" on user_profiles for all using (auth.uid() = id);
create policy "own" on report_nodes for all using (auth.uid() = user_id);
create policy "own" on dimensions for all using (auth.uid() = user_id);
create policy "own" on daily_logs for all using (auth.uid() = user_id);
create policy "own" on summaries for all using (auth.uid() = user_id);
```

---

## 十一、后端逻辑

### 11.1 生成总结时的数据抓取（写在后端，不写在 Prompt）

```typescript
// /app/api/summary/generate/route.ts

const priorityMap: Record<string, string[]> = {
  annual:    ['quarterly', 'monthly', 'weekly'],
  quarterly: ['monthly', 'weekly'],
  monthly:   ['weekly'],
  weekly:    [],
  adhoc:     [],
}

async function fetchDataSources(userId, dateFrom, dateTo, summaryType) {
  const priorities = priorityMap[summaryType] || []
  const foundSummaries = []

  // 优先：找时间范围内的定稿报告
  for (const type of priorities) {
    const { data } = await supabase
      .from('summaries')
      .select('*')
      .eq('user_id', userId)
      .eq('summary_type', type)
      .eq('is_draft', false)
      .gte('date_from', dateFrom)
      .lte('date_to', dateTo)
      .order('date_from')
    if (data?.length) foundSummaries.push(...data)
  }

  // 兜底：原始日志（始终加载）
  const { data: logs } = await supabase
    .from('daily_logs')
    .select('*, dimensions(name, level, parent_id)')
    .eq('user_id', userId)
    .gte('log_date', dateFrom)
    .lte('log_date', dateTo)
    .order('log_date')

  const completeness =
    foundSummaries.length >= priorities.length ? 'complete'
    : foundSummaries.length > 0 ? 'partial'
    : 'logs_only'

  return { summaries: foundSummaries, logs: logs || [], completeness }
}
```

### 11.2 AI 局部替换实现

```typescript
// /app/api/summary/ai-replace/route.ts
// AI 返回的替换建议格式（Prompt 中规定）：
// {
//   "type": "replace_suggestion",
//   "target_section": "需求分析第二段",  // 用于前端定位
//   "original": "原文内容...",
//   "replacement": "替换后的内容..."
// }

// 前端收到后：
// 1. 在预览区对应位置插入替换建议卡片
// 2. 用户点「采纳」→ 在 Markdown 编辑器中用 replacement 替换 original
// 3. 用户点「复制」→ 复制 replacement 到剪贴板
// 4. 用户点「不替换」→ 移除卡片
```

### 11.3 认证逻辑

**认证方式：** Supabase Auth（邮箱 + 密码）

**关键配置（在 Supabase 控制台操作一次）：**
```
Authentication → Providers → Email → 关闭「Confirm email」
```

**前端调用（直接用 Supabase 客户端，不需要 API Route）：**
```typescript
import { createClient } from '@/lib/supabase/client'
const supabase = createClient()

// 注册
const { data, error } = await supabase.auth.signUp({ email, password })

// 登录
const { data, error } = await supabase.auth.signInWithPassword({ email, password })

// 登出
await supabase.auth.signOut()
```

**错误码处理：**
```
注册：error.message 含 'already registered' → 「该邮箱已注册，请直接登录」
登录：error.message 含 'Invalid login'      → 「邮箱或密码错误」
```

**middleware.ts（路由保护）：**
```typescript
// 放在项目根目录（和 app/ 同级）
// 拦截 /profile、/log、/summary 的所有请求
// 无 session → redirect('/login')
// 使用 @supabase/ssr 的 middleware 写法

export const config = {
  matcher: ['/profile/:path*', '/log/:path*', '/summary/:path*'],
}
```

**两种 Supabase 服务端客户端的区别：**
```typescript
// /lib/supabase/server.ts

// 用途一：读取当前用户 session（page.tsx、middleware 里用）
// 使用 @supabase/ssr + cookies，受 RLS 限制
export function createSessionClient(cookieStore) { ... }

// 用途二：服务端数据操作（API Route 里用）
// 使用 service_role key，绕过 RLS
export function createServerClient() { ... }
```

### 11.4 API 接口清单

```
# 认证（前端直接调 Supabase，无需 API Route）
Supabase Auth signUp / signInWithPassword / signOut

# 职业档案
POST /api/profile/update               更新职业档案字段
POST /api/profile/ai-chat              职业档案 AI 对话（流式输出）
                                       入参：{
                                         messages,          // 对话历史
                                         profile_data,      // 职业画像全量数据
                                         report_nodes,      // 汇报框架全量数据
                                         dimensions,        // 记录维度全量数据
                                         is_new_user,       // 是否新用户
                                         current_focus      // 当前聚焦部分：'profile'|'report'|'dimension'|null
                                       }
POST /api/report-nodes/save            保存汇报节点
POST /api/dimensions/save              保存记录维度

# 工作日志
POST /api/log/save                     保存日志
GET  /api/log/[date]                   获取指定日期日志
POST /api/log/ai-chat                  日志 AI 助手（流式输出）

# 汇报总结
POST /api/summary/check-completeness   检查数据完整度
POST /api/summary/generate             生成总结草稿（流式输出）
POST /api/summary/ai-chat              总结 AI 助手（含替换建议，流式输出）
POST /api/summary/finalize             存为定稿
GET  /api/summary/list                 历史总结列表
```

---

## 十二、AI System Prompt

### 12.1 日常记录 AI 助手

```
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
```

### 12.2 工作总结生成

```
你是职业顾问，帮用户将工作记录整理成汇报总结，输出 Markdown 格式。

【汇报框架】
{report_framework}

【数据完整度】{completeness}

【数据来源】
{sources}

【输出要求】
1. 严格按照用户的汇报框架组织章节（h2/h3 对应框架模块）
2. 从流水账提炼成亮点，不简单堆砌
3. 汇报语气，不是日记语气
4. 只用用户提供的内容，不编造

【特殊标注】
- AI 推测：<!-- ai-guess: 推测内容 -->
- 信息缺口：<!-- placeholder: 请补充：缺少什么 -->

【报告类型语气】
- weekly：平实，强调完成情况和下周计划
- monthly：强调目标达成和趋势
- quarterly：强调战略贡献，有总结性洞察
- annual：强调影响力和成长，语气有分量

【数据完整度处理】
- partial：开头注明「本报告基于 X 篇月报定稿 + Y 条日志生成」
- logs_only：开头注明「本报告直接基于日志生成」
```

### 12.3 工作总结 AI 助手（含替换建议）

```
你是用户工作总结的润色顾问。

【当前总结内容（Markdown）】
{current_content}

【你的任务】
用户会告诉你想改哪个章节或哪段内容，你给出替换建议。

【规则】
- 只改用户指定的部分，不动其他内容
- 不编造新事实，只优化表达
- 给出替换建议时，明确指出是哪一段

【替换建议输出格式】严格按以下 JSON：
{
  "type": "replace_suggestion",
  "target_section": "「需求分析」第二段",
  "original": "原文内容（完整复制，用于前端匹配）",
  "replacement": "替换后的内容"
}

如果用户只是聊天没有明确要替换，正常文字回复即可，不输出 JSON。
```

### 12.4 职业档案 AI 助手（统一顾问）

```
你是 Trace 的职业档案顾问。你的职责是帮用户逐步建立或完善职业档案，包括三个部分：
职业画像、汇报框架、记录维度。

【用户完整档案数据】

职业画像：
{profile_data}
（含：职位、行业、工作年限、公司规模、工作职责、职业方向）

汇报框架：
{report_nodes}
（含：完整的汇报层级节点树）

记录维度：
{dimensions}
（含：完整的维度树及最小层级提示词）

【用户状态】
is_new_user: {is_new_user}
current_focus: {current_focus}
（current_focus 取值：'profile' | 'report' | 'dimension' | null）

---

【开场逻辑】

如果 is_new_user 为 true 且 current_focus 为 null：
  发送新用户开场白：
  「你好！我来帮你建立职业档案。我们需要完成三个部分：职业画像、汇报框架、记录维度。
   我会逐步问你，你来回答，确认后内容会直接保存到对应页面。
   我们先从职业画像开始，可以吗？」
  等用户确认后，将 current_focus 设为 'profile'，进入职业画像信息收集。

如果 is_new_user 为 false 且 current_focus 为 null：
  读取三个部分的已有内容，发送老用户开场白（选择题形式）：
  「你好！我已读取你的完整职业档案。你今天想调整哪个部分？
   A. 职业画像　B. 汇报框架　C. 记录维度」
  等用户选择后，将 current_focus 设为对应值，进入该部分的对话。

如果 current_focus 已有值：
  继续当前部分的对话，不重新开场。

---

【各部分对话策略】

▸ 职业画像（current_focus = 'profile'）
  收集信息：职位、行业、工作年限、公司规模、工作职责描述、职业方向（可选）
  对话策略：
  - 每次只问一个问题，口语化
  - 已有内容的字段跳过，不重复询问
  - 工作职责：引导用户描述日常主要工作内容和负责领域
  - 职业方向：可选，用户说「跳过」则不填
  收集完毕后生成预览：
  {
    "type": "profile_preview",
    "target": "profile",
    "content": {
      "job_title": "...",
      "industry": "...",
      "work_years": ...,
      "company_size": "...",
      "job_responsibilities": "...",
      "career_direction": "...",
      "skill_focus": "..."
    }
  }

▸ 汇报框架（current_focus = 'report'）
  收集信息：汇报周期、汇报对象、每层汇报包含的主要模块
  对话策略：
  - 已有框架内容作为基础，问用户是要新建还是调整
  - 从最高层级（年报/述职）往下问到日常记录
  - 每层确认：名称、触发时机、汇报对象、包含模块
  收集完毕后生成预览：
  {
    "type": "profile_preview",
    "target": "report",
    "content": [
      {
        "name": "年度述职",
        "trigger_desc": "每年12月",
        "audience": "VP / CEO",
        "time_granularity": "annual",
        "parent_id": null,
        "modules": [{"id":"m1","name":"全年核心贡献","description":"主导项目交付结果与影响"}]
      }
    ]
  }

▸ 记录维度（current_focus = 'dimension'）
  收集信息：基于汇报框架倒推应该每天记录的维度
  对话策略：
  - 优先读取已有的汇报框架（如有），从框架模块倒推维度
  - 结合用户职位，提出维度建议，让用户确认或调整
  - 维度名称结合用户实际职位，不用「工作进展」这类通用词
  - 最小层级的 prompt_text 要有引导性，像了解情况的同事在追问
  收集完毕后生成预览：
  {
    "type": "profile_preview",
    "target": "dimension",
    "content": [
      {
        "name": "需求分析", "icon": "📋", "level": 1,
        "children": [
          {
            "name": "日常需求", "level": 2,
            "children": [
              {"name":"今日进展","level":3,"prompt_text":"今天在需求侧做了什么？推进到哪了？"}
            ]
          }
        ]
      }
    ]
  }

---

【采纳 / 放弃后的衔接引导】

用户采纳后：
  「已保存到{已采纳的部分名称}。
   接下来我们{下一个未完成部分}，可以吗？」
  （如果三个部分都已完成，则说：「职业档案三个部分都已建立完成！你可以随时回来调整。」）

用户放弃后：
  「好的，这部分先放一放。你想继续完善{当前部分}，还是先去聊{其他部分}？」

---

【全局注意事项】
- 始终以三个 Tab 的完整内容作为上下文，不因 Tab 切换而遗忘之前了解的信息
- 有专业主动性：发现框架缺失常见层级时主动提醒，发现职业方向模糊时给出引导
- 不只顺从用户，有自己的职业建议，但尊重用户最终选择
- 语气口语化、亲切，像一个懂职场的朋友在陪你聊
```

---

## 十三、组件开发清单

按顺序开发，每个做完能独立运行才继续下一个：

```
阶段零：认证（最先做）
├── app/login/page.tsx                  登录/注册页面
├── middleware.ts                       路由保护（项目根目录）
├── app/page.tsx                        根路由（session 判断跳转）
├── lib/supabase/client.ts              前端 Supabase 客户端
└── lib/supabase/server.ts              后端两种客户端

阶段一：职业档案 /profile
├── lib/ai.ts                           callAI / callAIStream 封装
├── lib/prompts.ts                      所有 Prompt 集中管理
├── types/index.ts                      所有 TypeScript 类型
├── components/layout/Sidebar.tsx       左侧导航栏（三个页面复用）
├── app/profile/page.tsx                三 Tab 主页面框架
├── components/AiSidePanel.tsx          右侧 AI 对话栏（所有页面复用）
│                                       注：/profile 内需维护 current_focus 状态
│                                           并在调用 ai-chat 接口时传入
├── components/profile/OnboardingModal.tsx      新用户引导弹窗
├── components/profile/BasicInfoCard.tsx        基本信息（含编辑态 + 空状态）
├── components/profile/ResponsibilitiesCard.tsx 工作职责
├── components/profile/CareerDirectionCard.tsx  职业方向
├── components/profile/ReportNodeTree.tsx       汇报框架树（含空状态）
├── components/profile/ReportNodeEditor.tsx     汇报节点编辑表单
├── components/profile/DimensionTree.tsx        记录维度树（含空状态）
└── components/profile/DimensionNodeEditor.tsx  维度节点编辑

阶段二：工作日志 /log
├── app/log/page.tsx                    两栏主布局
├── components/log/DateNav.tsx          顶部日期导航
├── components/log/DimensionDirectory.tsx  左栏目录
├── components/log/LogContent.tsx       右栏内容区
├── components/log/LogField.tsx         单个字段（手动/AI两种状态）
└── components/log/SaveButton.tsx       底部保存按钮

阶段三：汇报总结 /summary
├── app/summary/page.tsx                主页面（左列表 + 右内容）
├── components/summary/SummaryList.tsx          左侧历史列表
├── components/summary/SummaryListItem.tsx      单条总结（含属性浮层）
├── components/summary/NewSummaryModal.tsx      新建总结弹窗
├── components/summary/DataCompletenessAlert.tsx 数据完整度提示
├── components/summary/SummaryTopbar.tsx        文档操作栏
├── components/summary/MarkdownEditor.tsx       编辑/预览切换编辑器
├── components/summary/AiReplaceCard.tsx        AI 替换建议卡片
└── components/summary/RevertConfirm.tsx        恢复上版确认弹窗
```

---

## 十四、给 AI 开发工具的约束

```
1.  每次只做当前 task 文件要求的内容，做完告知，等验收后再继续
2.  API 调用统一放在 /app/api/，组件不直接调用外部 API
3.  认证（登录/注册）直接调用 Supabase Auth，不需要 API Route
4.  所有 Prompt 写在 /lib/prompts.ts，不散落其他文件
5.  环境变量放 .env.local，绝不硬编码任何 Key
6.  每个 API Route 必须有 try/catch，出错返回友好提示
7.  每个等待操作必须有 loading 状态
8.  新依赖先告知，不擅自 npm install
9.  所有数据结构在 /types/index.ts 定义 interface，不用 any
10. 不做 task 文件「不做什么」里列出的功能
11. components/AiSidePanel.tsx 是通用组件，三个页面复用同一个
    /profile 页面在此组件内维护 current_focus 状态（'profile'|'report'|'dimension'|null）
    每次调用 /api/profile/ai-chat 时将三 Tab 全量数据和 current_focus 一起传入
12. 没有 /onboarding 路由，OnboardingModal 集成在 /profile 里
13. 颜色必须用 DESIGN.md 里的十六进制值，不用 Tailwind 颜色名
14. 不用 box-shadow，用 border 代替
15. /profile 的 AI 对话历史在切换 Tab 时不清空，仅跳转到其他页面（/log、/summary）时才清空
```

---

## 十五、接入 AI 模型

```typescript
// /lib/ai.ts
import OpenAI from 'openai'

const client = new OpenAI({
  baseURL: 'https://api.deepseek.com',
  apiKey: process.env.DEEPSEEK_API_KEY,
})

export async function callAI(
  messages: { role: 'user' | 'assistant'; content: string }[],
  systemPrompt: string,
  temperature = 0.7
) {
  try {
    const response = await client.chat.completions.create({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
      temperature,
    })
    return response.choices[0].message.content ?? ''
  } catch (error) {
    console.error('AI call failed:', error)
    throw new Error('AI 服务暂时不可用，请稍后重试')
  }
}
```

---

## 十六、第一步要做什么

**只做一件事：职业档案页（/profile）+ 新用户引导弹窗**

完成标准：
1. 新用户进入 /profile，自动弹出引导弹窗
2. 点「和 AI 一起填写」→ 关闭弹窗 + 打开 AI 助手面板
3. AI 介绍整体流程，确认从职业画像开始
4. AI 逐步收集职业画像信息（职位、工作职责等）
5. AI 生成职业画像预览 → 输入框锁定 → 用户采纳 → 内容写入 Tab 1
6. AI 主动引导进入汇报框架阶段，重复上述流程
7. AI 主动引导进入记录维度阶段，重复上述流程
8. 三个 Tab 全部完成后，底部出现「前往工作日志 →」跳转按钮
9. 数据库 user_profiles、report_nodes、dimensions 表能查到对应记录

老用户进入 /profile：
- 不弹弹窗，直接展示已有内容，AI 不自动打开
- 用户主动点开 AI 助手，AI 读取三 Tab 全量内容，用选择题询问要调整哪个部分

---

*文档版本：v7.0 | 2026.04.25 | 职业档案 AI 助手重构：统一顾问模式 + 三 Tab 全量上下文 + 逐项引导确认 + 切 Tab 不清空对话*
