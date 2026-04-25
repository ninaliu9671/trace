interface TabSwitchDialogProps {
  onConfirm: () => void
  onCancel: () => void
}

// v7: Tab 切换仅在有未采纳预览时才弹提示，对话历史保留不清空
export default function TabSwitchDialog({ onConfirm, onCancel }: TabSwitchDialogProps) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 60,
      backgroundColor: 'rgba(0,0,0,0.2)',
      backdropFilter: 'blur(2px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: '#FFFFFF',
        border: '1px solid #E8E4DD',
        borderRadius: 10,
        padding: '24px 28px',
        width: 360,
      }}>
        <p style={{ fontSize: 14, color: '#1A1A1A', lineHeight: 1.7, marginBottom: 20 }}>
          有未采纳的 AI 生成内容，切换 Tab 后预览卡片将关闭，但对话历史保留。
        </p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{
              fontSize: 13, color: '#0F6E56',
              border: '1px solid #9FE1CB', borderRadius: 7,
              padding: '6px 16px', background: '#E8F7F2', cursor: 'pointer',
            }}
          >
            先处理
          </button>
          <button
            onClick={onConfirm}
            style={{
              fontSize: 13, color: '#FFFFFF',
              border: 'none', borderRadius: 7,
              padding: '6px 16px',
              background: '#1A1A1A',
              cursor: 'pointer',
            }}
          >
            继续切换
          </button>
        </div>
      </div>
    </div>
  )
}
