import { NextRequest, NextResponse } from 'next/server'
import { callAI } from '@/lib/ai'
import { PROMPTS } from '@/lib/prompts'
import { AiMessage, ProfilePreview } from '@/types'

function extractJson(text: string): string {
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (codeBlockMatch) return codeBlockMatch[1].trim()
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (jsonMatch) return jsonMatch[0]
  return text.trim()
}

function parsePreview(text: string): ProfilePreview | null {
  try {
    const parsed = JSON.parse(extractJson(text))
    if (parsed?.type === 'profile_preview' && parsed?.target && parsed?.content) {
      return parsed as ProfilePreview
    }
  } catch {
    // not valid JSON / not a preview
  }
  return null
}

/** Returns true when the AI announced it's about to show a preview but included no JSON. */
function looksLikePreviewAnnouncement(text: string): boolean {
  const hasAnnouncementKeyword = ['预览如下', '已生成', '已整理好', '请查看下方', '卡片', '生成预览', '预览卡', '如下预览'].some(
    kw => text.includes(kw)
  )
  const hasJson = text.includes('"type"') && text.includes('"profile_preview"')
  return hasAnnouncementKeyword && !hasJson
}

export async function POST(req: NextRequest) {
  try {
    const {
      messages,
      profile_data,
      report_nodes,
      dimensions,
      is_new_user,
      current_focus,
    }: {
      messages: AiMessage[]
      profile_data: string
      report_nodes: string
      dimensions: string
      is_new_user: boolean
      current_focus: string | null
    } = await req.json()

    const systemPrompt = PROMPTS.profile_advisor
      .replace('{profile_data}', profile_data || '暂无数据')
      .replace('{report_nodes}', report_nodes || '暂无数据')
      .replace('{dimensions}', dimensions || '暂无数据')
      .replace('{is_new_user}', String(is_new_user))
      .replace('{current_focus}', current_focus ?? 'null')

    const aiMessages = messages.map(m => ({ role: m.role, content: m.content }))

    // First attempt
    const content = await callAI(aiMessages, systemPrompt)
    let profilePreview = parsePreview(content)

    // Retry: AI announced a preview but didn't include JSON — ask it to output JSON directly
    if (!profilePreview && looksLikePreviewAnnouncement(content)) {
      const retryMessages: { role: 'user' | 'assistant'; content: string }[] = [
        ...aiMessages,
        { role: 'assistant', content },
        { role: 'user', content: '请直接输出 JSON，不要加任何其他文字。' },
      ]
      const retryContent = await callAI(retryMessages, systemPrompt, 0.3)
      const retryPreview = parsePreview(retryContent)
      if (retryPreview) {
        profilePreview = retryPreview
      }
    }

    const targetLabel =
      profilePreview?.target === 'profile' ? '职业画像'
      : profilePreview?.target === 'report' ? '汇报框架'
      : '记录维度'

    const displayContent = profilePreview
      ? `已帮你整理好了${targetLabel}的内容，请查看下方预览。`
      : content

    return NextResponse.json({ content: displayContent, profilePreview })
  } catch {
    return NextResponse.json({ error: 'AI 服务暂时不可用，请稍后重试' }, { status: 500 })
  }
}
