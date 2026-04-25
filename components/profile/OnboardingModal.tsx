'use client'

interface OnboardingModalProps {
  onWithAI: () => void
  onSelf: () => void
  onDismiss: () => void
}

export default function OnboardingModal({ onWithAI, onSelf, onDismiss }: OnboardingModalProps) {
  return (
    <div
      className="fixed inset-0 z-50"
      style={{ backgroundColor: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(2px)' }}
    >
      <div
        className="absolute"
        style={{
          width: 420,
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: '#FFFFFF',
          borderRadius: 12,
          border: '1px solid #E8E4DD',
          padding: 32,
        }}
      >
        {/* × 关闭 */}
        <button
          onClick={onDismiss}
          style={{
            position: 'absolute',
            top: 16,
            right: 16,
            color: '#B0ADA6',
            fontSize: 16,
            lineHeight: 1,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          ×
        </button>

        <div style={{ fontSize: 24, marginBottom: 12 }}>👋</div>
        <h2 style={{ fontSize: 18, fontWeight: 500, color: '#1A1A1A', marginBottom: 12 }}>
          欢迎使用 Trace 履迹
        </h2>
        <p style={{ fontSize: 13, color: '#6B6B6B', lineHeight: 1.7, marginBottom: 20 }}>
          在开始记录之前，先花 3 分钟建立你的职业档案。<br />
          AI 会根据你的情况，设计一套专属的记录框架。
        </p>

        {/* 三步引导 */}
        <div style={{ marginBottom: 24 }}>
          {['告诉 AI 你的职业背景', 'AI 帮你设计汇报框架', '确认后开始每日记录'].map((step, i) => (
            <div key={i} style={{ fontSize: 13, color: '#1A1A1A', marginBottom: 6 }}>
              <span style={{ color: '#B0ADA6', marginRight: 8 }}>{'①②③'[i]}</span>
              {step}
            </div>
          ))}
        </div>

        {/* 按钮组 */}
        <button
          onClick={onWithAI}
          style={{
            width: '100%',
            height: 40,
            background: '#1D9E75',
            color: '#FFFFFF',
            borderRadius: 8,
            border: 'none',
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
            marginBottom: 8,
          }}
        >
          ✦ 和 AI 一起填写
        </button>
        <button
          onClick={onSelf}
          style={{
            width: '100%',
            height: 40,
            background: 'transparent',
            color: '#6B6B6B',
            borderRadius: 8,
            border: '1px solid #E8E4DD',
            fontSize: 13,
            cursor: 'pointer',
            marginBottom: 12,
          }}
        >
          我自己来填
        </button>
        <div style={{ textAlign: 'center' }}>
          <span
            onClick={onDismiss}
            style={{ fontSize: 12, color: '#B0ADA6', cursor: 'pointer' }}
          >
            稍后再说
          </span>
        </div>
      </div>
    </div>
  )
}
