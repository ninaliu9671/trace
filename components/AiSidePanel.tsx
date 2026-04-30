'use client'

import { useEffect, useRef, useState } from 'react'
import {
  AiConversationState,
  AiMessage,
  DimensionOpsPreview,
  ProfilePreview,
  ProfilePreviewTarget,
  UserProfile,
  ReportNode,
  Dimension,
} from '@/types'
import ProfilePreviewCard from '@/components/profile/ProfilePreviewCard'
import AiReplaceCard from '@/components/summary/AiReplaceCard'
import LogPreviewCard from '@/components/log/LogPreviewCard'
import { LogPreviewItem } from '@/types'
import { buildDimensionTree } from '@/lib/dimensionUtils'

interface AiSidePanelProps {
  isOpen: boolean
  onClose: () => void
  // profile 页面专用：三 Tab 全量数据
  isNewUser?: boolean
  profileData?: UserProfile | null
  reportNodes?: ReportNode[]
  dimensions?: Dimension[]
  currentFocus?: ProfilePreviewTarget | null
  onCurrentFocusChange?: (focus: ProfilePreviewTarget | null) => void
  onPreviewAdopt?: (preview: ProfilePreview | DimensionOpsPreview) => Promise<void>
  // log 页面专用：占位上下文（Task 12 再替换真实值）
  logDimensionsTree?: string
  logExistingLogs?: string
  // 通用
  contextLabel: string
  apiRoute: string
  initialMessage?: string
  // 外部触发：自动以用户身份发送一条消息（用于"让AI帮我设计"入口）
  autoSendMessage?: string | null
  onAutoSendConsumed?: () => void
  onConversationStateChange?: (state: AiConversationState) => void
  // summary 页面专用
  extraBodyParams?: Record<string, unknown>
  onReplaceSuggestionAdopt?: (original: string, replacement: string) => boolean
  // log 页面专用
  onLogPreviewAdopt?: (items: LogPreviewItem[]) => void
}

export default function AiSidePanel({
  isOpen,
  onClose,
  isNewUser,
  profileData,
  reportNodes,
  dimensions,
  currentFocus,
  onCurrentFocusChange,
  onPreviewAdopt,
  logDimensionsTree,
  logExistingLogs,
  contextLabel,
  apiRoute,
  initialMessage,
  autoSendMessage,
  onAutoSendConsumed,
  onConversationStateChange,
  extraBodyParams,
  onReplaceSuggestionAdopt,
  onLogPreviewAdopt,
}: AiSidePanelProps) {
  const [messages, setMessages] = useState<AiMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [ended, setEnded] = useState(false)
  const [attachedFileText, setAttachedFileText] = useState<string | null>(null)
  const [attachedFileName, setAttachedFileName] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const hasPendingPreview = messages.some(
    m => (m.messageType === 'profile_preview' && !m.confirmed && !m.discarded) ||
         (m.messageType === 'dimension_ops_preview' && !m.confirmed && !m.discarded) ||
         (m.messageType === 'replace_suggestion' && !m.confirmed && !m.discarded) ||
         (m.messageType === 'log_preview' && !m.confirmed && !m.discarded)
  )
  const inputLocked = sending || ended || hasPendingPreview

  function extractBalancedJsonObject(text: string, anchor?: string): string | null {
    const source = String(text || '')
    const start = anchor ? source.indexOf(anchor) : 0
    if (start < 0) return null
    const from = source.lastIndexOf('{', start)
    const begin = from >= 0 ? from : source.indexOf('{')
    if (begin < 0) return null
    let depth = 0
    let inString = false
    let escaped = false
    for (let i = begin; i < source.length; i++) {
      const ch = source[i]
      if (inString) {
        if (escaped) escaped = false
        else if (ch === '\\') escaped = true
        else if (ch === '"') inString = false
        continue
      }
      if (ch === '"') {
        inString = true
        continue
      }
      if (ch === '{') depth++
      if (ch === '}') {
        depth--
        if (depth === 0) return source.slice(begin, i + 1)
      }
    }
    return null
  }

  function parseDimensionOpsPreviewFromText(text: string): DimensionOpsPreview | null {
    try {
      const balanced = extractBalancedJsonObject(text, '"dimension_ops_preview"')
        ?? extractBalancedJsonObject(text, '"operations"')
      if (!balanced) return null
      const parsed = JSON.parse(balanced)
      if (parsed?.type === 'dimension_ops_preview' && parsed?.target === 'dimension' && Array.isArray(parsed?.operations)) {
        return parsed as DimensionOpsPreview
      }
    } catch {
      // continue
    }
    return null
  }

  // 面板打开且有初始消息时显示（同时监听 initialMessage，
  // 因为 isNewUser 是异步确定的，初始消息可能在面板已打开后才就绪）
  useEffect(() => {
    if (isOpen && initialMessage && messages.length === 0) {
      setMessages([{ role: 'assistant', content: initialMessage }])
    }
  }, [isOpen, initialMessage, messages.length])

  useEffect(() => {
    onConversationStateChange?.({
      hasMessages: messages.length > 0,
      isEnded: ended,
      hasPendingPreview,
    })
  }, [messages, ended, hasPendingPreview, onConversationStateChange])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // 外部触发自动发送：面板打开且不在发送状态时执行
  useEffect(() => {
    if (!autoSendMessage || !isOpen || sending || inputLocked) return
    onAutoSendConsumed?.()
    const text = autoSendMessage
    const userMsg: AiMessage = { role: 'user', content: text }
    const updatedMessages = [...messages, userMsg]
    setMessages(updatedMessages)
    setSending(true)

    const isProfilePage = apiRoute === '/api/profile/ai-chat'
    const body = isProfilePage
      ? {
          messages: updatedMessages.map(m => ({ role: m.role, content: m.content })),
          profile_data: buildProfileDataString(profileData),
          report_nodes: buildReportNodesString(reportNodes ?? []),
          dimensions: buildDimensionsString(dimensions ?? []),
          is_new_user: isNewUser ?? false,
          current_focus: currentFocus ?? null,
        }
      : apiRoute === '/api/log/ai-chat'
        ? {
            messages: updatedMessages.map(m => ({ role: m.role, content: m.content })),
            dimensionsTree: logDimensionsTree ?? '暂无维度数据',
            existingLogs: logExistingLogs ?? '今天暂无记录',
          }
        : { messages: updatedMessages.map(m => ({ role: m.role, content: m.content })) }

    fetch(apiRoute, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
      .then(async r => {
        const data = await r.json()
        if (!r.ok || data?.error) {
          throw new Error(data?.error || 'AI 服务暂时不可用，请稍后重试。')
        }
        return data
      })
      .then(data => {
        if (data.logPreview) {
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: data.content || '我已经整理好了，请查看下方预览。',
            messageType: 'log_preview' as const,
            logPreviewData: data.logPreview,
          }])
        } else if (data.dimensionOpsPreview) {
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: data.content || '我已经整理好了，请查看下方变更清单。',
            messageType: 'dimension_ops_preview' as const,
            dimensionOpsPreviewData: data.dimensionOpsPreview,
          }])
          onCurrentFocusChange?.('dimension')
        } else if (data.profilePreview) {
          const previewMessage = buildProfilePreviewMessage(
            data.profilePreview as ProfilePreview,
            data.content || '我已经整理好了，请查看下方预览。'
          )
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: previewMessage,
            messageType: 'profile_preview' as const,
            profilePreview: data.profilePreview,
          }])
          onCurrentFocusChange?.(data.profilePreview.target)
        } else {
          const opsPreview = parseDimensionOpsPreviewFromText(String(data.content || ''))
          if (opsPreview) {
            setMessages(prev => [...prev, {
              role: 'assistant',
              content: '我已经整理好了变更清单，请查看下方采纳卡。',
              messageType: 'dimension_ops_preview' as const,
              dimensionOpsPreviewData: opsPreview,
            }])
            onCurrentFocusChange?.('dimension')
            return
          }
          setMessages(prev => [...prev, { role: 'assistant', content: data.content || '我先理解到这里，你可以继续补充。' }])
        }
      })
      .catch(() => {
        setMessages(prev => [...prev, { role: 'assistant', content: 'AI 服务暂时不可用，请稍后重试。' }])
      })
      .finally(() => setSending(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSendMessage, isOpen])

  function buildProfileDataString(p: UserProfile | null | undefined): string {
    if (!p) return '暂无数据'
    const lines = [
      p.job_title            && `职位：${p.job_title}`,
      p.industry             && `行业：${p.industry}`,
      p.work_years           && `工作年限：${p.work_years} 年`,
      p.company_size         && `公司规模：${p.company_size}`,
      p.job_responsibilities && `工作职责：${p.job_responsibilities}`,
      p.career_direction     && `职业方向：${p.career_direction}`,
      p.skill_focus          && `技能重点：${p.skill_focus}`,
    ].filter(Boolean)
    return lines.join('\n') || '暂无数据'
  }

  function buildReportNodesString(nodes: ReportNode[]): string {
    if (!nodes || nodes.length === 0) return '暂无数据'
    return nodes.map(n => {
      const mods = n.modules?.map(m => m.name).join('、') ?? ''
      return [
        `【${n.name}】`,
        n.trigger_desc && `  触发时机：${n.trigger_desc}`,
        n.audience     && `  汇报对象：${n.audience}`,
        mods           && `  包含模块：${mods}`,
      ].filter(Boolean).join('\n')
    }).join('\n\n')
  }

  function buildDimensionsString(dims: Dimension[]): string {
    if (!dims || dims.length === 0) return '暂无数据'

    const lines: string[] = []
    const tree = buildDimensionTree(dims)

    function walk(nodes: Dimension[], prefix = '') {
      nodes.forEach((node, index) => {
        const n = prefix ? `${prefix}.${index + 1}` : `${index + 1}`
        const indent = '  '.repeat(Math.max(0, node.level - 1))
        const prompt = node.level === 3 && node.prompt_text ? `（提示词：${node.prompt_text}）` : ''
        lines.push(`${indent}[N:${n}][ID:${node.id}] ${node.name}${prompt}`)
        if (node.children && node.children.length > 0) {
          walk(node.children, n)
        }
      })
    }

    walk(tree)
    return lines.join('\n')
  }

  function buildDimensionDeleteHint(previewDims: ProfilePreviewDimension[]): string | null {
    const currentLevel1 = dimensions.filter(d => d.level === 1).map(d => d.name)
    const previewLevel1 = previewDims.map(d => d.name)
    const removed = currentLevel1.filter(name => !previewLevel1.includes(name))
    if (removed.length === 0) return null
    return `将删除：${removed.join('、')}`
  }

  function buildProfilePreviewMessage(preview: ProfilePreview | undefined, fallback: string): string {
    if (!preview) return fallback
    if (preview.target !== 'dimension') return fallback
    const hint = buildDimensionDeleteHint(preview.content as ProfilePreviewDimension[])
    return hint ? `${fallback}\n${hint}` : fallback
  }

  async function handleSend() {
    const rawText = input.trim()
    const filePrefix = attachedFileText
      ? `[文件：${attachedFileName}]\n${attachedFileText}\n\n`
      : ''
    const text = filePrefix + rawText
    if (!text.trim() || inputLocked) return
    // 发送后清除附件
    setAttachedFileText(null)
    setAttachedFileName(null)

    const userMsg: AiMessage = { role: 'user', content: text }
    const updatedMessages = [...messages, userMsg]
    setMessages(updatedMessages)
    setInput('')
    setSending(true)

    try {
      const isProfilePage = apiRoute === '/api/profile/ai-chat'

    const body = isProfilePage
      ? {
          messages: updatedMessages.map(m => ({ role: m.role, content: m.content })),
          profile_data: buildProfileDataString(profileData),
          report_nodes: buildReportNodesString(reportNodes ?? []),
          dimensions: buildDimensionsString(dimensions ?? []),
          is_new_user: isNewUser ?? false,
          current_focus: currentFocus ?? null,
        }
      : apiRoute === '/api/log/ai-chat'
        ? {
            messages: updatedMessages.map(m => ({ role: m.role, content: m.content })),
            dimensionsTree: logDimensionsTree ?? '暂无维度数据',
            existingLogs: logExistingLogs ?? '今天暂无记录',
          }
        : {
            messages: updatedMessages.map(m => ({ role: m.role, content: m.content })),
            ...(extraBodyParams ?? {}),
          }

      const res = await fetch(apiRoute, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok || data?.error) {
        throw new Error(data?.error || 'AI 服务暂时不可用，请稍后重试。')
      }

      if (data.replaceSuggestion) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: data.content || '我已经整理好了，请查看下方建议。',
          messageType: 'replace_suggestion' as const,
          replaceSuggestionData: data.replaceSuggestion,
        }])
      } else if (data.logPreview) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: data.content || '我已经整理好了，请查看下方预览。',
          messageType: 'log_preview' as const,
          logPreviewData: data.logPreview,
        }])
      } else if (data.dimensionOpsPreview) {
        setMessages(prev => [
          ...prev,
          {
            role: 'assistant',
            content: data.content || '我已经整理好了，请查看下方变更清单。',
            messageType: 'dimension_ops_preview' as const,
            dimensionOpsPreviewData: data.dimensionOpsPreview,
          },
        ])
        onCurrentFocusChange?.('dimension')
      } else if (data.profilePreview) {
        const previewMessage = buildProfilePreviewMessage(
          data.profilePreview as ProfilePreview,
          data.content || '我已经整理好了，请查看下方预览。'
        )
        setMessages(prev => [
          ...prev,
          {
            role: 'assistant',
            content: previewMessage,
            messageType: 'profile_preview' as const,
            profilePreview: data.profilePreview,
          },
        ])
        onCurrentFocusChange?.(data.profilePreview.target)
      } else {
        const opsPreview = parseDimensionOpsPreviewFromText(String(data.content || ''))
        if (opsPreview) {
          setMessages(prev => [
            ...prev,
            {
              role: 'assistant',
              content: '我已经整理好了变更清单，请查看下方采纳卡。',
              messageType: 'dimension_ops_preview' as const,
              dimensionOpsPreviewData: opsPreview,
            },
          ])
          onCurrentFocusChange?.('dimension')
          return
        }
        setMessages(prev => [
          ...prev,
          { role: 'assistant', content: data.content || '我先理解到这里，你可以继续补充。' },
        ])
      }
    } catch {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: 'AI 服务暂时不可用，请稍后重试。' },
      ])
    } finally {
      setSending(false)
    }
  }

  async function handleAdopt(preview: ProfilePreview | DimensionOpsPreview, msgIndex: number) {
    try {
      await onPreviewAdopt?.(preview)
      const targetLabel =
        preview.target === 'profile' ? '职业画像'
        : preview.target === 'report' ? '汇报框架'
        : '记录维度'

      // 标记当前预览卡为已采纳
      const confirmMsg: AiMessage = {
        role: 'user',
        content: `已采纳${targetLabel}，请继续。`,
      }
      const messagesAfterConfirm = messages.map((m, i) =>
        i === msgIndex ? { ...m, confirmed: true } : m
      ).concat(confirmMsg)
      setMessages(messagesAfterConfirm)
      onCurrentFocusChange?.(null)

      // 用采纳消息触发 AI 回复（推进到下一部分）
      setSending(true)
      const isProfilePage = apiRoute === '/api/profile/ai-chat'
      const body = isProfilePage
        ? {
            messages: messagesAfterConfirm.map(m => ({ role: m.role, content: m.content })),
            profile_data: buildProfileDataString(profileData),
            report_nodes: buildReportNodesString(reportNodes ?? []),
            dimensions: buildDimensionsString(dimensions ?? []),
            is_new_user: false,
            current_focus: null,
          }
        : { messages: messagesAfterConfirm.map(m => ({ role: m.role, content: m.content })) }

      fetch(apiRoute, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
        .then(r => r.json())
        .then(data => {
          if (data.dimensionOpsPreview) {
            setMessages(prev => [...prev, {
              role: 'assistant',
              content: data.content || '我已经整理好了，请查看下方变更清单。',
              messageType: 'dimension_ops_preview' as const,
              dimensionOpsPreviewData: data.dimensionOpsPreview,
            }])
            onCurrentFocusChange?.('dimension')
          } else if (data.profilePreview) {
            const previewMessage = buildProfilePreviewMessage(
              data.profilePreview as ProfilePreview,
              data.content || '我已经整理好了，请查看下方预览。'
            )
            setMessages(prev => [...prev, {
              role: 'assistant',
              content: previewMessage,
              messageType: 'profile_preview' as const,
              profilePreview: data.profilePreview,
            }])
            onCurrentFocusChange?.(data.profilePreview.target)
          } else {
            setMessages(prev => [...prev, { role: 'assistant', content: data.content }])
          }
        })

        .catch(() => {
          setMessages(prev => [...prev, { role: 'assistant', content: 'AI 服务暂时不可用，请稍后重试。' }])
        })
        .finally(() => setSending(false))
    } catch (e) {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: (e as Error).message || '保存失败，请稍后重试。' },
      ])
    }
  }

  function handleDiscard(msgIndex: number) {
    setMessages(prev => prev.map((m, i) =>
      i === msgIndex ? { ...m, discarded: true } : m
    ))
    onCurrentFocusChange?.(null)
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    // 只支持文本文件
    if (!file.type.startsWith('text/') && !file.name.endsWith('.txt')) {
      alert('目前只支持上传 .txt 文本文件')
      e.target.value = ''
      return
    }
    const reader = new FileReader()
    reader.onload = (ev) => {
      const content = ev.target?.result as string
      setAttachedFileText(content)
      setAttachedFileName(file.name)
    }
    reader.readAsText(file, 'utf-8')
    e.target.value = '' // 允许重复选同一文件
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        width: 280,
        height: '100vh',
        background: '#FFFFFF',
        borderLeft: '1px solid #E8E4DD',
        transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.2s ease',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 40,
      }}
    >
      {/* 顶部标题栏 */}
      <div
        style={{
          height: 48,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          borderBottom: '1px solid #F0EDE8',
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 500, color: '#1A1A1A' }}>✦ AI 助手</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {messages.length > 0 && (
            <button
              onClick={() => {
                const hasPendingDecision = messages.some(
                  m =>
                    (m.messageType === 'replace_suggestion' || m.messageType === 'log_preview') &&
                    !m.confirmed &&
                    !m.discarded
                )
                if (hasPendingDecision && !window.confirm('有未处理的 AI 建议，结束后将丢失。确认结束？')) return
                setEnded(true)
              }}
              disabled={ended}
              style={{
                fontSize: 12,
                color: ended ? '#B0ADA6' : '#6B6B6B',
                border: '1px solid #E8E4DD',
                borderRadius: 6,
                padding: '3px 8px',
                background: 'transparent',
                cursor: ended ? 'default' : 'pointer',
              }}
            >
              结束对话
            </button>
          )}
          <button
            onClick={onClose}
            style={{ fontSize: 16, color: '#B0ADA6', lineHeight: 1, background: 'none', border: 'none', cursor: 'pointer' }}
          >
            ×
          </button>
        </div>
      </div>

      {/* 上下文横幅 */}
      <div
        style={{
          padding: '8px 16px',
          background: '#F0FBF7',
          borderBottom: '1px solid #E8F7F2',
          fontSize: 12,
          color: '#0F6E56',
          flexShrink: 0,
        }}
      >
        {contextLabel}
      </div>

      {/* 消息区 */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        {messages.map((msg, i) => {
          if (msg.messageType === 'profile_preview' && msg.profilePreview) {
            return (
              <ProfilePreviewCard
                key={i}
                preview={msg.profilePreview}
                adopted={msg.confirmed}
                discarded={msg.discarded}
                onAdopt={(p) => handleAdopt(p, i)}
                onDiscard={() => handleDiscard(i)}
              />
            )
          }
          if (msg.messageType === 'dimension_ops_preview' && msg.dimensionOpsPreviewData) {
            return (
              <ProfilePreviewCard
                key={i}
                preview={msg.dimensionOpsPreviewData}
                adopted={msg.confirmed}
                discarded={msg.discarded}
                onAdopt={(p) => handleAdopt(p, i)}
                onDiscard={() => handleDiscard(i)}
              />
            )
          }
          if (msg.messageType === 'replace_suggestion' && msg.replaceSuggestionData) {
            return (
              <AiReplaceCard
                key={i}
                data={msg.replaceSuggestionData}
                adopted={msg.confirmed}
                discarded={msg.discarded}
                onAdopt={(original, replacement) => {
                  const success = onReplaceSuggestionAdopt?.(original, replacement) ?? true
                  if (success !== false) {
                    setMessages(prev => prev.map((m, idx) =>
                      idx === i ? { ...m, confirmed: true, discarded: false } : m
                    ))
                  }
                  return success
                }}
                onCopy={() => {}}
                onDismiss={() => {
                  setMessages(prev => prev.map((m, idx) =>
                    idx === i ? { ...m, confirmed: false, discarded: true } : m
                  ))
                }}
              />
            )
          }
          if (msg.messageType === 'log_preview' && msg.logPreviewData) {
            return (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 8, alignSelf: 'stretch' }}>
                {!!msg.content && (
                  <div
                    style={{
                      background: '#F8F7F4',
                      borderRadius: '0 8px 8px 8px',
                      border: '1px solid #E8E4DD',
                      padding: '8px 12px',
                      fontSize: 13,
                      color: '#1A1A1A',
                      lineHeight: 1.7,
                      maxWidth: '85%',
                      alignSelf: 'flex-start',
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {msg.content}
                  </div>
                )}
                <LogPreviewCard
                  data={msg.logPreviewData}
                  adopted={msg.confirmed}
                  discarded={msg.discarded}
                  onAdopt={() => {
                    onLogPreviewAdopt?.(msg.logPreviewData?.items ?? [])
                    setMessages(prev => prev.map((m, idx) =>
                      idx === i ? { ...m, confirmed: true, discarded: false } : m
                    ))
                  }}
                  onDiscard={() => {
                    setMessages(prev => prev.map((m, idx) =>
                      idx === i ? { ...m, confirmed: false, discarded: true } : m
                    ))
                  }}
                />
              </div>
            )
          }
          return msg.role === 'assistant' ? (
            <div
              key={i}
              style={{
                background: '#F8F7F4',
                borderRadius: '0 8px 8px 8px',
                border: '1px solid #E8E4DD',
                padding: '8px 12px',
                fontSize: 13,
                color: '#1A1A1A',
                lineHeight: 1.7,
                maxWidth: '85%',
                alignSelf: 'flex-start',
                whiteSpace: 'pre-wrap',
              }}
            >
              {msg.content}
            </div>
          ) : (
            <div
              key={i}
              style={{
                background: '#1A1A1A',
                color: '#FFFFFF',
                borderRadius: '8px 0 8px 8px',
                padding: '8px 12px',
                fontSize: 13,
                lineHeight: 1.7,
                maxWidth: '85%',
                alignSelf: 'flex-end',
              }}
            >
              {msg.content}
            </div>
          )
        })}

        {sending && (
          <div
            style={{
              background: '#F8F7F4',
              borderRadius: '0 8px 8px 8px',
              border: '1px solid #E8E4DD',
              padding: '8px 12px',
              fontSize: 13,
              color: '#B0ADA6',
              maxWidth: '85%',
              alignSelf: 'flex-start',
            }}
          >
            ...
          </div>
        )}

        {ended && (
          <div style={{ textAlign: 'center', fontSize: 12, color: '#B0ADA6', padding: '8px 0' }}>
            — 本轮对话已结束 —
          </div>
        )}
      </div>

      {/* 输入区 */}
      <div
        style={{
          padding: 12,
          borderTop: '1px solid #F0EDE8',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          flexShrink: 0,
        }}
      >
        {hasPendingPreview && (
          <div style={{ fontSize: 12, color: '#B0ADA6', textAlign: 'center', padding: '2px 0' }}>
            请先对上方内容做选择
          </div>
        )}
        {attachedFileName && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 12,
            color: '#0F6E56',
            background: '#F0FBF7',
            border: '1px solid #9FE1CB',
            borderRadius: 6,
            padding: '4px 8px',
          }}>
            📎 {attachedFileName}
            <button
              onClick={() => { setAttachedFileText(null); setAttachedFileName(null) }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B6B6B', fontSize: 13, lineHeight: 1 }}
            >
              ×
            </button>
          </div>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          {/* 隐藏的 file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,text/plain"
            style={{ display: 'none' }}
            onChange={handleFileSelect}
            disabled={inputLocked}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={inputLocked}
            title="上传文本文件"
            style={{
              width: 32,
              height: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'transparent',
              border: '1px solid #E8E4DD',
              borderRadius: 7,
              cursor: inputLocked ? 'not-allowed' : 'pointer',
              color: inputLocked ? '#B0ADA6' : '#6B6B6B',
              fontSize: 15,
              flexShrink: 0,
              alignSelf: 'flex-end',
            }}
          >
            📎
          </button>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
            placeholder={hasPendingPreview ? '请先处理上方预览' : '输入消息...'}
            disabled={inputLocked}
            rows={1}
            style={{
              flex: 1,
              resize: 'none',
              border: '1px solid #E8E4DD',
              borderRadius: 7,
              padding: '7px 10px',
              fontSize: 13,
              outline: 'none',
              fontFamily: 'inherit',
              lineHeight: 1.5,
              background: inputLocked ? '#F8F7F4' : '#FFFFFF',
              cursor: inputLocked ? 'not-allowed' : 'text',
              color: inputLocked ? '#B0ADA6' : '#1A1A1A',
            }}
          />
          <button
            onClick={handleSend}
            disabled={(!input.trim() && !attachedFileText) || inputLocked}
            style={{
              width: 60,
              background: (input.trim() || attachedFileText) && !inputLocked ? '#1D9E75' : '#E8E4DD',
              color: (input.trim() || attachedFileText) && !inputLocked ? '#FFFFFF' : '#B0ADA6',
              borderRadius: 7,
              border: 'none',
              fontSize: 12,
              fontWeight: 500,
              cursor: (input.trim() || attachedFileText) && !inputLocked ? 'pointer' : 'default',
              flexShrink: 0,
            }}
          >
            {sending ? '...' : '发送'}
          </button>
        </div>
      </div>
    </div>
  )
}
