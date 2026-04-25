import type { Metadata } from 'next'
import { DM_Sans } from 'next/font/google'
import './globals.css'

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
})

export const metadata: Metadata = {
  title: 'Trace 履迹',
  description: '随手记录每天的工作，AI 整理成随时可用的汇报总结',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="zh-CN">
      <body className={`${dmSans.variable} min-h-full`}>
        {children}
      </body>
    </html>
  )
}
