import { NextRequest, NextResponse } from 'next/server'
import { callAI } from '@/lib/ai'
import { AiMessage } from '@/types'
import { PROMPTS } from '@/lib/prompts'

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

    const content = await callAI(
      messages.map(m => ({ role: m.role, content: m.content })),
      systemPrompt
    )

    let logPreview: unknown = null
    try {
      // Strip markdown code blocks if present
      let jsonStr = content.trim()
      const codeBlockMatch = jsonStr.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/m)
      if (codeBlockMatch) {
        jsonStr = codeBlockMatch[1].trim()
      }

      const parsed = JSON.parse(jsonStr)
      if (parsed?.type === 'log_preview') logPreview = parsed
    } catch {
      // 普通对话文字，忽略
    }

    return NextResponse.json({ content, logPreview })
  } catch {
    return NextResponse.json({ error: 'AI 服务暂时不可用，请稍后重试' }, { status: 500 })
  }
}
