interface RevertConfirmProps {
  onConfirm: () => void
  onCancel: () => void
}

export default function RevertConfirm({ onConfirm, onCancel }: RevertConfirmProps) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 60,
      background: 'rgba(0,0,0,0.2)',
      backdropFilter: 'blur(2px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: '#FFFFFF',
        border: '1px solid #E8E4DD',
        borderRadius: 10,
        padding: '24px 28px',
        width: 360,
        boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
      }}>
        <p style={{ fontSize: 14, color: '#1A1A1A', lineHeight: 1.7, marginBottom: 20 }}>
          恢复到上一个保存版本？当前未保存的修改将丢失。
        </p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{
              fontSize: 13, color: '#6B6B6B',
              border: '1px solid #E8E4DD', borderRadius: 7,
              padding: '6px 16px', background: 'transparent', cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            style={{
              fontSize: 13, color: '#FFFFFF',
              border: 'none', borderRadius: 7,
              padding: '6px 16px',
              background: '#D94F4F',
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            确认恢复
          </button>
        </div>
      </div>
    </div>
  )
}
