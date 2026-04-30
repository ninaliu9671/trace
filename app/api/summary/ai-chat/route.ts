import { NextRequest, NextResponse } from 'next/server'
import { callAI } from '@/lib/ai'
import { AiMessage } from '@/types'
import { PROMPTS } from '@/lib/prompts'

export async function POST(req: NextRequest) {
  try {
    const {
      messages,
      currentContent,
      isFinalized,
    }: {
      messages: AiMessage[]
      currentContent: string
      isFinalized?: boolean
    } = await req.json()

    const finalizedNote = isFinalized
      ? '\n\n【重要限制】当前报告已定稿，你不能输出 replace_suggestion JSON。如果用户希望修改报告内容，必须先提醒他们点击右上角「重新编辑」按钮开启编辑模式，再与你交互。在用户开启编辑模式前，只能讨论内容，不能提出任何替换建议。'
      : ''

    const systemPrompt =
      PROMPTS.summary_assistant
        .replace('{current_content}', currentContent || '（未提供总结内容）')
      + finalizedNote

    const content = await callAI(
      messages.map(m => ({ role: m.role, content: m.content })),
      systemPrompt
    )

    // 定稿状态下不解析 replace_suggestion
    let replaceSuggestion = null
    if (!isFinalized) {
      try {
        const parsed = JSON.parse(content)
        if (parsed?.type === 'replace_suggestion') replaceSuggestion = parsed
      } catch {
        // 普通对话文字，忽略
      }
    }

    return NextResponse.json({ content, replaceSuggestion })
  } catch {
    return NextResponse.json(
      { error: 'AI 服务暂时不可用，请稍后重试' },
      { status: 500 }
    )
  }
}
