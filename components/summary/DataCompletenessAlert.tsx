'use client'
import { CompletenessResult } from '@/types'
import { normalizeCompletenessResult } from '@/lib/summary-result'

interface DataCompletenessAlertProps {
  result: CompletenessResult
  onProceed: () => void   // 「直接生成」
  onCancel: () => void    // 「先去补写」→ 关闭，用户回到日志页
}

export default function DataCompletenessAlert({
  result, onProceed, onCancel,
}: DataCompletenessAlertProps) {
  const safeResult = normalizeCompletenessResult(result)

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50,
      background: 'rgba(0,0,0,0.2)',
      backdropFilter: 'blur(3px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: '#FFFFFF',
        border: '1px solid #E8E4DD',
        borderRadius: 12,
        width: 420,
        maxWidth: 'calc(100vw - 32px)',
        padding: '24px',
        boxShadow: '0 16px 48px rgba(0,0,0,0.12)',
      }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: '#1A1A1A', marginBottom: 16 }}>
          数据准备情况
        </div>

        {/* 已找到的数据 */}
        <div style={{ marginBottom: 12 }}>
          {safeResult.found_summaries.map((item, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'flex-start', gap: 8,
              fontSize: 13, color: '#1A1A1A', lineHeight: 1.6,
              marginBottom: 6,
            }}>
              <span style={{ color: '#1D9E75', flexShrink: 0, marginTop: 2 }}>✓</span>
              <span>{item.label}</span>
            </div>
          ))}

          {/* 缺失的数据 */}
          {safeResult.missing_types.map((item, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'flex-start', gap: 8,
              fontSize: 13, color: '#6B6B6B', lineHeight: 1.6,
              marginBottom: 6,
            }}>
              <span style={{ color: '#F59E0B', flexShrink: 0, marginTop: 2 }}>✗</span>
              <span>{item.label}</span>
            </div>
          ))}

          {/* 日志数量 */}
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: 8,
            fontSize: 13, color: '#1A1A1A', lineHeight: 1.6,
            marginBottom: 6,
          }}>
            <span style={{ color: '#1D9E75', flexShrink: 0, marginTop: 2 }}>✓</span>
            <span>找到 {safeResult.logs_count} 条日志记录</span>
          </div>
        </div>

        {/* 提示说明 */}
        {safeResult.completeness === 'logs_only' && (
          <div style={{
            fontSize: 12, color: '#B0ADA6',
            background: '#F8F7F4', borderRadius: 6, padding: '8px 12px',
            marginBottom: 20,
          }}>
            数据较少，AI 将直接基于日志生成，可能不够全面。
          </div>
        )}
        {safeResult.completeness === 'partial' && (
          <div style={{
            fontSize: 12, color: '#B0ADA6',
            background: '#F8F7F4', borderRadius: 6, padding: '8px 12px',
            marginBottom: 20,
          }}>
            部分历史定稿缺失，AI 将以现有数据尽量补充完整。
          </div>
        )}

        {/* 操作按钮 */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{
              padding: '8px 16px',
              border: '1px solid #E8E4DD', borderRadius: 7,
              background: 'transparent', color: '#6B6B6B',
              fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            先去补写
          </button>
          <button
            onClick={onProceed}
            style={{
              padding: '8px 16px',
              border: 'none', borderRadius: 7,
              background: '#1A1A1A', color: '#FFFFFF',
              fontSize: 13, fontWeight: 500,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            直接生成
          </button>
        </div>
      </div>
    </div>
  )
}
