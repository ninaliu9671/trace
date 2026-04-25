export function toDateString(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// 获取本周一到本周日（ISO 周，周一为第一天）
export function getThisWeekRange(): { from: string; to: string } {
  const today = new Date()
  const day = today.getDay()                        // 0=日，1=一...
  const diffToMonday = day === 0 ? -6 : 1 - day    // 调整到周一
  const monday = new Date(today)
  monday.setDate(today.getDate() + diffToMonday)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  return { from: toDateString(monday), to: toDateString(sunday) }
}

// 获取本月第一天到最后一天
export function getThisMonthRange(): { from: string; to: string } {
  const today = new Date()
  const y = today.getFullYear()
  const m = today.getMonth()
  const first = new Date(y, m, 1)
  const last = new Date(y, m + 1, 0)
  return { from: toDateString(first), to: toDateString(last) }
}

// 获取本季度第一天到最后一天
export function getThisQuarterRange(): { from: string; to: string } {
  const today = new Date()
  const y = today.getFullYear()
  const q = Math.floor(today.getMonth() / 3)       // 0=Q1，1=Q2...
  const firstMonth = q * 3
  const lastMonth = firstMonth + 2
  const first = new Date(y, firstMonth, 1)
  const last = new Date(y, lastMonth + 1, 0)
  return { from: toDateString(first), to: toDateString(last) }
}
