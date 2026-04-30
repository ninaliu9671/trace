import { NextRequest, NextResponse } from 'next/server'
import { callAI } from '@/lib/ai'
import { AiMessage } from '@/types'
import { PROMPTS } from '@/lib/prompts'

function extractJson(text: string): string {
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (codeBlockMatch) return codeBlockMatch[1].trim()
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (jsonMatch) return jsonMatch[0]
  return text.trim()
}

type ParsedLogPreview = {
  type: 'log_preview'
  items: Array<{
    dimension_id: string
    dimension_name: string
    content: string
  }>
}

type DimensionDict = Record<string, string>

function parseLogPreview(text: string): ParsedLogPreview | null {
  try {
    const parsed = JSON.parse(extractJson(text))
    if (parsed?.type === 'log_preview' && Array.isArray(parsed?.items)) {
      return parsed as ParsedLogPreview
    }
  } catch {
    // not valid JSON / not a preview
  }
  return null
}

function parseDimensionDict(dimensionsTree: string): DimensionDict {
  const dict: DimensionDict = {}
  const lines = String(dimensionsTree || '').split('\n')
  for (const line of lines) {
    const match = line.match(/\[ID:([^\]]+)\]\s*(.+)$/)
    if (!match) continue
    const id = match[1].trim()
    const rawName = match[2].trim()
    const normalizedName = rawName
      .replace(/（[^）]*）/g, '')
      .replace(/\([^)]*\)/g, '')
      .trim()
    if (id && normalizedName) {
      dict[id] = normalizedName
    }
  }
  return dict
}

function normalizePreview(preview: ParsedLogPreview, dict: DimensionDict): ParsedLogPreview {
  const normalizedItems = preview.items
    .filter(item => Boolean(item?.dimension_id && dict[item.dimension_id]))
    .map(item => ({
      dimension_id: item.dimension_id,
      // 统一以系统维度名为准，避免 AI 乱造或挂错显示层级
      dimension_name: dict[item.dimension_id],
      content: String(item.content ?? '').trim(),
    }))
    .filter(item => item.content.length > 0)

  return {
    type: 'log_preview',
    items: normalizedItems,
  }
}

function userExplicitlyConfirmed(messages: AiMessage[]): boolean {
  const lastUserMessage = [...messages].reverse().find(m => m.role === 'user')?.content ?? ''
  return /(确认|可以|同意|就这样|没问题|采纳|ok|okay|yes)/i.test(lastUserMessage)
}

function buildConfirmationText(preview: ParsedLogPreview): string {
  const lines = preview.items.map((item, index) => {
    return `${index + 1}. 【${item.dimension_name}】${item.content}`
  })
  return `我先按这个版本帮你拆解好了：\n${lines.join('\n')}\n\n如果你确认，我就生成可采纳卡片；如果要改，我可以继续调整。`
}

export async function POST(req: NextRequest) {
  try {
    const {
      messages,
      dimensionsTree,
      existingLogs,
    }: {
      messages: AiMessage[]
      dimensionsTree: string
      existingLogs: string
    } = await req.json()

    const systemPrompt = PROMPTS.log_assistant
      .replace('{dimensions_tree}', dimensionsTree || '暂无维度数据')
      .replace('{existing_logs}', existingLogs || '今天暂无记录')

    const aiMessages = messages.map(m => ({ role: m.role, content: m.content }))
    const content = await callAI(aiMessages, systemPrompt)
    const dimensionDict = parseDimensionDict(dimensionsTree)

    const parsedPreview = parseLogPreview(content)
    const confirmed = userExplicitlyConfirmed(messages)

    if (parsedPreview) {
      const normalizedPreview = normalizePreview(parsedPreview, dimensionDict)
      if (confirmed) {
        if (normalizedPreview.items.length === 0) {
          return NextResponse.json({
            content: '我收到了你的确认，但这版维度匹配失败。请让我先重新整理一版，再由你确认。',
            logPreview: null,
          })
        }
        return NextResponse.json({
          content: '已按你的确认整理完成。请查看下方卡片并选择采纳或不采纳。',
          logPreview: normalizedPreview,
        })
      }

      // 用户还未确认时，不展示卡片，只展示自然语言确认文案
      return NextResponse.json({
        content: buildConfirmationText(normalizedPreview),
        logPreview: null,
      })
    }

    // 用户已确认但首轮没有可解析预览：强制二次生成纯 JSON，保证可出卡片
    if (confirmed) {
      const retryMessages: { role: 'user' | 'assistant'; content: string }[] = [
        ...aiMessages,
        { role: 'assistant', content },
        {
          role: 'user',
          content:
            '请严格只输出 log_preview JSON，不要任何说明文字，不要 markdown 代码块。',
        },
      ]
      const retryContent = await callAI(retryMessages, systemPrompt, 0.2)
      const retryPreview = parseLogPreview(retryContent)
      if (retryPreview) {
        const normalizedRetryPreview = normalizePreview(retryPreview, dimensionDict)
        if (normalizedRetryPreview.items.length === 0) {
          return NextResponse.json({
            content: '我收到了你的确认，但这版维度匹配失败。请让我先重新整理一版，再由你确认。',
            logPreview: null,
          })
        }
        return NextResponse.json({
          content: '已按你的确认整理完成。请查看下方卡片并选择采纳或不采纳。',
          logPreview: normalizedRetryPreview,
        })
      }
      return NextResponse.json({
        content:
          '我收到了你的确认，但本次整理结果还没成功生成卡片。请回复“确认”再试一次，或让我先重新整理一版。',
        logPreview: null,
      })
    }

    const fallbackText = content?.trim() || '我先理解到这里了。你可以继续补充，我会再帮你调整并确认。'
    return NextResponse.json({ content: fallbackText, logPreview: null })
  } catch {
    return NextResponse.json({ error: 'AI 服务暂时不可用，请稍后重试' }, { status: 500 })
  }
}
