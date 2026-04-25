import { NextRequest, NextResponse } from 'next/server'
import { callAI } from '@/lib/ai'
import { AiMessage } from '@/types'
import { PROMPTS } from '@/lib/prompts'

export async function POST(req: NextRequest) {
  try {
    const {
      messages,
      currentContent,
    }: {
      messages: AiMessage[]
      currentContent: string
    } = await req.json()

    const systemPrompt = PROMPTS.summary_assistant
      .replace('{current_content}', currentContent || '（未提供总结内容）')

    const content = await callAI(
      messages.map(m => ({ role: m.role, content: m.content })),
      systemPrompt
    )

    // 尝试解析是否为 replace_suggestion JSON
    let replaceSuggestion = null
    try {
      const parsed = JSON.parse(content)
      if (parsed?.type === 'replace_suggestion') replaceSuggestion = parsed
    } catch {
      // 普通对话文字，忽略
    }

    return NextResponse.json({ content, replaceSuggestion })
  } catch {
    return NextResponse.json(
      { error: 'AI 服务暂时不可用，请稍后重试' },
      { status: 500 }
    )
  }
}
