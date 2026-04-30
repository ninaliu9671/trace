'use client'

import { useState } from 'react'
import {
  DimensionOpsPreview,
  ProfilePreview,
  ProfilePreviewProfileContent,
  ProfilePreviewReportNode,
  ProfilePreviewDimension,
} from '@/types'

interface ProfilePreviewCardProps {
  preview: ProfilePreview | DimensionOpsPreview
  onAdopt: (preview: ProfilePreview | DimensionOpsPreview) => Promise<void>
  onDiscard: () => void
  adopted?: boolean
  discarded?: boolean
}

const TARGET_LABEL: Record<string, string> = {
  profile: '职业画像',
  report: '汇报框架',
  dimension: '记录维度',
}

function ProfileContent({ content }: { content: ProfilePreviewProfileContent }) {
  const fields = [
    content.job_title     && `职位：${content.job_title}`,
    content.industry      && `行业：${content.industry}`,
    content.work_years    && `工作年限：${content.work_years} 年`,
    content.company_size  && `公司规模：${content.company_size}`,
  ].filter(Boolean) as string[]

  return (
    <div style={{ fontSize: 12, color: '#1A1A1A', lineHeight: 1.8 }}>
      {fields.map((f, i) => <div key={i}>· {f}</div>)}
      {content.job_responsibilities && (
        <div style={{ marginTop: 6 }}>
          <span style={{ color: '#6B6B6B' }}>工作职责：</span>
          <span style={{ whiteSpace: 'pre-wrap' }}>{content.job_responsibilities}</span>
        </div>
      )}
    </div>
  )
}

function ReportContent({ content }: { content: ProfilePreviewReportNode[] }) {
  return (
    <div style={{ fontSize: 12, color: '#1A1A1A', lineHeight: 1.8 }}>
      {content.slice(0, 5).map((node, i) => (
        <div key={i}>· {node.name}{node.style ? `（${node.style}）` : ''}</div>
      ))}
      {content.length > 5 && <div style={{ color: '#B0ADA6' }}>…共 {content.length} 个节点</div>}
    </div>
  )
}

function DimensionContent({ content }: { content: ProfilePreviewDimension[] }) {
  return (
    <div style={{ fontSize: 12, color: '#1A1A1A', lineHeight: 1.8 }}>
      {content.map((dim, i) => (
        <div key={i}>
          {dim.icon ?? '📋'} {dim.name}
          {dim.children && (
            <span style={{ color: '#B0ADA6', marginLeft: 6 }}>
              ({dim.children.length} 个子维度)
            </span>
          )}
        </div>
      ))}
    </div>
  )
}

function DimensionOpsContent({ preview }: { preview: DimensionOpsPreview }) {
  const resolved = preview.resolved_targets ?? []
  const fallbackLines =
    resolved.length > 0
      ? []
      : preview.operations.map((op, i) => {
          if (op.op === 'add') {
            return `${i + 1}. 新增「${op.name ?? '未命名维度'}」`
          }
          if (op.op === 'delete') {
            return `${i + 1}. 删除 ${op.target_n ?? op.target_id ?? ''}（及子项）`
          }
          if (op.op === 'move') {
            return `${i + 1}. 移动 ${op.target_n ?? op.target_id ?? ''} 到 ${op.to_parent_n ?? op.to_parent_id ?? '顶层'}`
          }
          return `${i + 1}. 修改 ${op.target_n ?? op.target_id ?? ''}`
        })

  return (
    <div style={{ fontSize: 12, color: '#1A1A1A', lineHeight: 1.8 }}>
      {resolved.map((item, i) => (
        <div key={i}>· {item}</div>
      ))}
      {fallbackLines.map((line, i) => (
        <div key={`op-${i}`} style={{ color: '#6B6B6B' }}>{line}</div>
      ))}
      {(preview.warnings ?? []).map((w, i) => (
        <div key={`w-${i}`} style={{ color: '#B7791F' }}>⚠ {String(w).replace(/父/g, '母')}</div>
      ))}
    </div>
  )
}

export default function ProfilePreviewCard({
  preview,
  onAdopt,
  onDiscard,
  adopted,
  discarded,
}: ProfilePreviewCardProps) {
  const [loading, setLoading] = useState(false)
  const label = TARGET_LABEL[preview.target] ?? preview.target

  async function handleAdopt() {
    setLoading(true)
    await onAdopt(preview)
    setLoading(false)
  }

  if (adopted) {
    return (
      <div style={{
        background: '#F0FBF7',
        border: '1px solid #9FE1CB',
        borderRadius: 8,
        padding: '12px 14px',
        fontSize: 13,
        color: '#0F6E56',
      }}>
        ✓ 已写入{label}
      </div>
    )
  }

  if (discarded) {
    return (
      <div style={{
        background: '#F8F7F4',
        border: '1px solid #E8E4DD',
        borderRadius: 8,
        padding: '12px 14px',
        fontSize: 13,
        color: '#B0ADA6',
      }}>
        已放弃此版本
      </div>
    )
  }

  return (
    <div style={{
      background: '#F0FBF7',
      border: '1px solid #9FE1CB',
      borderRadius: 8,
      padding: 14,
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
    }}>
      <div style={{ fontWeight: 500, color: '#0F6E56', fontSize: 13 }}>
        ✦ AI 生成的{label}预览
      </div>

      <div style={{
        background: '#FFFFFF',
        border: '1px solid #E8E4DD',
        borderRadius: 6,
        padding: '10px 12px',
      }}>
        {preview.type === 'profile_preview' && preview.target === 'profile' && (
          <ProfileContent content={preview.content as ProfilePreviewProfileContent} />
        )}
        {preview.type === 'profile_preview' && preview.target === 'report' && (
          <ReportContent content={preview.content as ProfilePreviewReportNode[]} />
        )}
        {preview.type === 'profile_preview' && preview.target === 'dimension' && (
          <DimensionContent content={preview.content as ProfilePreviewDimension[]} />
        )}
        {preview.type === 'dimension_ops_preview' && (
          <DimensionOpsContent preview={preview} />
        )}
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={handleAdopt}
          disabled={loading}
          style={{
            flex: 1,
            padding: '7px 0',
            background: loading ? '#6B6B6B' : '#1D9E75',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: 7,
            fontSize: 12,
            fontWeight: 500,
            cursor: loading ? 'default' : 'pointer',
          }}
        >
          {loading ? '保存中...' : '采纳，写入档案'}
        </button>
        <button
          onClick={onDiscard}
          disabled={loading}
          style={{
            flex: 1,
            padding: '7px 0',
            background: 'transparent',
            color: '#6B6B6B',
            border: '1px solid #E8E4DD',
            borderRadius: 7,
            fontSize: 12,
            cursor: loading ? 'default' : 'pointer',
          }}
        >
          放弃，重新讨论
        </button>
      </div>
    </div>
  )
}
