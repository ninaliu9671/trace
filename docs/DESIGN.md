# DESIGN.md · Trace 履迹界面设计规范

> 给 Claude Code 的界面设计规范文档。每次开始任务前必须先读这个文件。
> 所有颜色、字体、间距、组件样式必须严格遵守本文档，不自由发挥。
> 版本：v1.0 | 2026.04.24

---

## 一、视觉风格定位

**安静、专业，像一本高质量工作手册。**

参考感觉：Notion 的克制 + Linear 的精准 + 一点点温度

- 不用渐变
- 不用阴影（用 border 代替）
- 不用动效（除了侧边栏滑出的 transition）
- 不用圆形头像以外的装饰性元素

---

## 二、颜色系统

**所有颜色直接写十六进制，不用 Tailwind 颜色名称（如 green-500 等）。**

### 基础色

```
页面背景：        #F8F7F4   bg-[#F8F7F4]
侧边栏背景：      #EDEAE4   bg-[#EDEAE4]
列表面板背景：    #FAFAF8   bg-[#FAFAF8]
卡片背景：        #FFFFFF   bg-white
主文字：          #1A1A1A   text-[#1A1A1A]
次要文字：        #6B6B6B   text-[#6B6B6B]
辅助文字：        #B0ADA6   text-[#B0ADA6]
极浅辅助文字：    #D3D1C7   text-[#D3D1C7]
边框：            #E8E4DD   border-[#E8E4DD]
分割线：          #F0EDE8
```

### 品牌绿（主要强调色）

```
品牌绿：          #1D9E75   用于：激活按钮、激活态、重要状态
浅绿背景：        #E8F7F2   用于：AI 按钮背景、成功状态背景
绿色边框：        #9FE1CB   用于：AI 按钮边框、成功状态边框
深绿文字：        #0F6E56   用于：AI 按钮文字、成功状态文字
极浅绿背景：      #F0FBF7   用于：AI 上下文栏背景
```

### 语义色

```
警告黄背景：      #FFFBEB   用于：AI 推测标注背景
警告黄边框：      #FDE68A
警告黄文字：      #92400E

错误红背景：      #FFF0F0   用于：占位符背景
错误红边框：      #F87171
错误红文字：      #B91C1C

橙色提醒：        #F59E0B   用于：导航小圆点（待完善提醒）
```

### AI 对话气泡

```
AI 消息背景：     #F8F7F4   border: #E8E4DD
用户消息背景：    #1A1A1A   text: #FFFFFF
```

### 已保存横幅

```
背景：            #F0FBF7
边框（底部）：    #9FE1CB
文字：            #0F6E56
```

---

## 三、字体

### 引入方式（在 app/layout.tsx 中引入）

```tsx
import { DM_Sans } from 'next/font/google'

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
})
```

### 使用规则

```
中文内容：        system-ui（跟随系统，苹方/微软雅黑）
英文、数字：      DM Sans（var(--font-dm-sans)）
Markdown 编辑器： JetBrains Mono（monospace）

body 默认字体设置：
  font-family: var(--font-dm-sans), system-ui, sans-serif
```

### 字号体系

```
页面标题：        text-[16px] font-medium（500）
Tab 标题：        text-[13px] font-medium
卡片小标题：      text-[11px] font-medium 全大写 tracking-[0.5px] text-[#B0ADA6]
正文：            text-[13px] font-normal leading-[1.7]
辅助说明：        text-[12px] font-normal
极小标签：        text-[10px] 或 text-[11px]
按钮文字：        text-[12px] 或 text-[13px] font-medium
```

---

## 四、间距与圆角

### 圆角

```
卡片：            rounded-[11px] 或 rounded-[12px]
按钮：            rounded-[7px] 或 rounded-[8px]
输入框：          rounded-[7px] 或 rounded-[8px]
标签/徽章：       rounded-[4px] 或 rounded-[6px]
弹窗：            rounded-[12px] 或 rounded-[14px]
```

### 内边距

```
页面内边距：      px-[20px] 或 px-[22px]（手机端 px-4）
卡片内边距：      p-[15px] 或 p-[18px]
侧边栏内边距：    px-[8px]
导航项内边距：    px-[10px] py-[7px]
```

### 间距

```
卡片之间：        mb-[12px]
字段之间：        mb-[14px]
行内元素间距：    gap-[7px] 或 gap-[8px]
```

---

## 五、全局布局

### 桌面端三栏布局

```tsx
<div className="flex h-screen bg-[#F8F7F4]">
  {/* 左侧边栏 */}
  <aside className="w-[172px] bg-[#EDEAE4] border-r border-[#E0DDD6] flex flex-col flex-shrink-0">
    ...
  </aside>

  {/* 主内容区 */}
  <main className="flex-1 flex flex-col overflow-hidden min-w-0 transition-all duration-300"
    style={{ marginRight: aiOpen ? '280px' : '0' }}>
    ...
  </main>

  {/* AI 助手面板 */}
  <div className={`fixed right-0 top-0 h-full w-[280px] bg-white border-l border-[#E8E4DD]
    flex flex-col transition-transform duration-300 z-10
    ${aiOpen ? 'translate-x-0' : 'translate-x-full'}`}>
    ...
  </div>
</div>
```

### 左侧边栏

```
宽度：            172px，固定，不可收起（MVP 阶段）
背景：            #EDEAE4
Logo 区域：       border-bottom: 1px solid #E0DDD6，padding: 15px 15px 12px
Logo 样式：       「Trace」黑色 15px/500，「履迹」绿色 #1D9E75
导航区：          padding: 8px
用户信息区：      border-top: 1px solid #E0DDD6，padding: 10px 8px
```

### 导航项样式

```tsx
// 默认态
<div className="flex items-center gap-[8px] px-[10px] py-[7px] rounded-[7px]
  text-[13px] text-[#6B6B6B] cursor-pointer hover:bg-[#E4E0D8]">
  <span className="w-[16px] text-center text-[14px]">{icon}</span>
  {name}
  {/* 待完善提醒点 */}
  {incomplete && <div className="ml-auto w-[7px] h-[7px] rounded-full bg-[#F59E0B]" />}
</div>

// 激活态（当前页面）
className="... bg-[#1D9E75] text-white hover:bg-[#1D9E75]"
```

---

## 六、通用组件样式

### 卡片

```tsx
<div className="bg-white border border-[#E8E4DD] rounded-[11px] p-[15px] mb-[12px]">
  {/* 卡片头部 */}
  <div className="flex items-center justify-between mb-[12px]">
    <span className="text-[11px] font-medium text-[#B0ADA6] uppercase tracking-[0.5px]">
      卡片标题
    </span>
    <div className="flex gap-[6px]">
      {/* 操作按钮 */}
    </div>
  </div>
  {/* 卡片内容 */}
</div>
```

### 按钮

```tsx
// 主按钮（绿色）
<button className="px-[14px] py-[6px] bg-[#1D9E75] text-white text-[13px] font-medium
  rounded-[7px] border-none cursor-pointer hover:bg-[#0F6E56] transition-colors">
  按钮文字
</button>

// 次级按钮（灰色边框）
<button className="px-[10px] py-[4px] bg-transparent text-[#6B6B6B] text-[12px]
  border border-[#E8E4DD] rounded-[6px] cursor-pointer hover:bg-[#F8F7F4]">
  按钮文字
</button>

// AI 按钮（浅绿）
<button className="flex items-center gap-[5px] px-[12px] py-[5px] bg-[#E8F7F2]
  border border-[#9FE1CB] rounded-[7px] text-[#0F6E56] text-[12px] font-medium
  cursor-pointer hover:bg-[#D4F0E6]">
  ✦ AI 助手
</button>

// AI 按钮激活态
className="... bg-[#1D9E75] text-white border-[#1D9E75] hover:bg-[#0F6E56]"

// 危险按钮（红色）
<button className="px-[16px] py-[7px] bg-[#D94F4F] text-white text-[13px]
  font-medium rounded-[7px] border-none cursor-pointer">
  确认操作
</button>
```

### 输入框

```tsx
// 单行输入框
<input className="w-full border border-[#E8E4DD] rounded-[7px] px-[9px] py-[6px]
  text-[13px] text-[#1A1A1A] bg-[#F8F7F4] outline-none font-inherit
  focus:border-[#1D9E75] focus:bg-white transition-colors" />

// 多行文本框
<textarea className="w-full border border-[#E8E4DD] rounded-[7px] px-[10px] py-[8px]
  text-[13px] text-[#1A1A1A] bg-[#F8F7F4] outline-none font-inherit resize-none
  leading-[1.65] focus:border-[#1D9E75] focus:bg-white transition-colors" />

// 已填写状态（左边绿色竖线）
className="... border-l-[2.5px] border-l-[#1D9E75] bg-[#FDFFFE]"

// AI 填入状态（浅绿竖线）
className="... border-l-[2.5px] border-l-[#9FE1CB] bg-[#F8FFFE] border-[#C5EAE0]"

// 锁定态（只读）
className="... bg-[#F8F7F4] border-[#F0EDE8] cursor-default resize-none"
```

### 标签/徽章

```tsx
// 草稿徽章
<span className="text-[10px] bg-[#FEF3C7] text-[#92400E] px-[6px] py-[1px] rounded-[4px]">
  草稿
</span>

// 定稿徽章
<span className="text-[10px] bg-[#E8F7F2] text-[#0F6E56] px-[6px] py-[1px] rounded-[4px]">
  定稿
</span>

// 普通标签（灰色）
<span className="text-[10px] bg-[#F1EFE8] text-[#6B6B6B] px-[5px] py-[1px] rounded-[3px]">
  标签文字
</span>

// 品牌绿标签
<span className="text-[12px] bg-[#E8F7F2] text-[#0F6E56] px-[8px] py-[2px] rounded-[4px] font-medium">
  标签文字
</span>
```

### 分割线

```tsx
// 水平分割线
<div className="h-[0.5px] bg-[#F0EDE8] my-[12px]" />

// border-bottom 版本
className="border-b border-[#E8E4DD]"
```

---

## 七、AI 助手面板（AiSidePanel）

```
宽度：            280px，固定
位置：            fixed right-0，全高
触发：            点击「✦ AI 助手」按钮展开，点 × 或再点按钮收起
过渡动画：        transition-transform duration-300（translateX）

面板结构（从上到下）：
┌─────────────────────────────┐
│ 顶部标题栏（bg: #F8F7F4）   │  高度 auto，border-bottom
│ ✦ AI 助手  [结束对话] [×]  │
├─────────────────────────────┤
│ 上下文说明栏（bg: #F0FBF7） │  border-bottom
│ 已读取：xxx 内容            │  11px，#0F6E56
├─────────────────────────────┤
│ 消息区（flex-1，可滚动）    │  padding: 12px 14px，gap: 9px
│                             │
│ AI 气泡（左对齐）           │  bg:#F8F7F4，border，圆角3px 9px 9px 9px
│           用户气泡（右对齐）│  bg:#1A1A1A，白字，圆角9px 3px 9px 9px
├─────────────────────────────┤
│ 输入区                      │  padding: 10px 14px，border-top
│ [输入框（flex-1）] [发送]   │
└─────────────────────────────┘
```

---

## 八、弹窗（Modal）

```tsx
// 遮罩层
<div className="fixed inset-0 bg-black/40 flex items-center justify-center z-100
  backdrop-blur-[2px] rounded-[12px]">

  {/* 弹窗主体 */}
  <div className="bg-white rounded-[12px] overflow-hidden shadow-[0_8px_40px_rgba(0,0,0,0.15)]"
    style={{ width: '弹窗宽度' }}>

    {/* 头部 */}
    <div className="flex items-center justify-between px-[22px] py-[16px]
      border-b border-[#E8E4DD]">
      <span className="text-[15px] font-medium text-[#1A1A1A]">弹窗标题</span>
      <span className="text-[20px] text-[#B0ADA6] cursor-pointer">×</span>
    </div>

    {/* 内容区 */}
    <div className="px-[22px] py-[18px]">...</div>

    {/* 底部操作 */}
    <div className="px-[22px] py-[14px] border-t border-[#E8E4DD] flex justify-end gap-[8px]">
      ...
    </div>
  </div>
</div>
```

---

## 九、空状态

```tsx
// 虚线卡片空状态（用于汇报框架、记录维度未填写时）
<div className="bg-[#F8F7F4] border border-dashed border-[#C8C4BD] rounded-[11px]
  p-[32px] text-center">
  <div className="text-[28px] opacity-30 mb-[10px]">{icon}</div>
  <div className="text-[14px] text-[#6B6B6B] mb-[6px]">标题</div>
  <div className="text-[12px] text-[#B0ADA6] leading-[1.6] mb-[16px]">说明文字</div>
  <button className="... AI 按钮样式 ...">✦ 让 AI 帮我设计</button>
</div>

// 字段空状态（斜体灰色）
<div className="text-[13px] text-[#D3D1C7] italic">未填写</div>
```

---

## 十、状态栏（页面底部）

```tsx
// 正常状态
<div className="px-[20px] py-[8px] border-t border-[#E8E4DD] bg-[#F8F7F4]
  flex items-center justify-between flex-shrink-0">
  <span className="text-[11px] text-[#B0ADA6]">上次更新：今天 15:18</span>
  <span className="text-[11px] text-[#1D9E75]">✓ 已保存</span>
</div>

// 待完善状态
<span className="text-[11px] text-[#F59E0B]">● 待完善</span>
```

---

## 十一、已保存横幅（/log 页面）

```tsx
<div className="bg-[#F0FBF7] border-b border-[#9FE1CB] px-[18px] py-[7px]
  flex items-center justify-between text-[12px] text-[#0F6E56] flex-shrink-0">
  <span>✓ 本日记录已保存 · 2026.04.24 18:32</span>
  <button className="px-[10px] py-[3px] bg-white border border-[#9FE1CB]
    rounded-[5px] text-[12px] text-[#0F6E56] cursor-pointer hover:bg-[#E8F7F2]">
    编辑
  </button>
</div>
```

---

## 十二、Tab 切换组件

```tsx
// Tab 栏容器
<div className="flex px-[20px] border-b border-[#E8E4DD] flex-shrink-0">
  {tabs.map(tab => (
    <div
      key={tab.id}
      onClick={() => setActiveTab(tab.id)}
      className={`flex items-center gap-[5px] px-[14px] py-[9px] text-[13px] cursor-pointer
        border-b-[2px] mb-[-0.5px] whitespace-nowrap transition-colors
        ${activeTab === tab.id
          ? 'text-[#1D9E75] border-[#1D9E75] font-medium'
          : 'text-[#6B6B6B] border-transparent hover:text-[#1A1A1A]'
        }`}
    >
      {/* Tab 填写状态圆点 */}
      <div className={`w-[5px] h-[5px] rounded-full
        ${tab.filled ? 'bg-[#1D9E75]' : 'bg-[#E8E4DD]'}`} />
      {tab.name}
    </div>
  ))}
</div>
```

---

## 十三、加载状态

```tsx
// 转圈动画（inline 写 keyframes 或用 Tailwind animate-spin）
<div className="w-[36px] h-[36px] rounded-full border-[2.5px] border-[#E8E4DD]
  border-t-[#1D9E75] animate-spin" />

// 按钮 loading 态
<button disabled className="... bg-[#6B6B6B] cursor-not-allowed">
  <span className="animate-spin">◌</span> 保存中...
</button>

// 按钮成功态（1.2s 后恢复）
<button className="... bg-[#1D9E75]">
  ✓ 已保存
</button>
```

---

## 十四、不允许的做法

```
❌ 使用 Tailwind 颜色名（green-500、gray-100 等），必须用十六进制
❌ 使用 box-shadow（用 border 代替）
❌ 使用渐变色
❌ 使用 Inter、Roboto、Arial 字体
❌ 字体颜色用 #333、#666 等非规范值，必须用颜色系统里的值
❌ 自定义动效（只允许侧边栏 transition 和 loading 的 animate-spin）
❌ 在卡片内部再嵌套卡片（最多一层卡片）
❌ 随意改变圆角大小（必须用规范值）
```

---

*DESIGN.md v1.0 | 2026.04.24*
