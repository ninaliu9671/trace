'use client'
import { useState, useEffect } from 'react'

const MESSAGES = [
  'AI 正在读取你的工作日志...',
  'AI 正在分析日志内容...',
  'AI 正在提炼工作亮点...',
  'AI 正在整理汇报结构...',
  '草稿即将生成完成...',
]

export default function SummaryGeneratingOverlay() {
  const [msgIndex, setMsgIndex] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setMsgIndex(prev => (prev + 1) % MESSAGES.length)
    }, 900)
    return () => clearInterval(timer)
  }, [])

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 60,
      background: 'rgba(248,247,244,0.85)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 20,
    }}>
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
      <div style={{
        width: 36, height: 36,
        border: '3px solid #E8E4DD',
        borderTop: '3px solid #1D9E75',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }} />
      <div style={{
        fontSize: 13,
        color: '#6B6B6B',
        textAlign: 'center',
        minWidth: 240,
        transition: 'opacity 0.3s ease',
      }}>
        {MESSAGES[msgIndex]}
      </div>
    </div>
  )
}
