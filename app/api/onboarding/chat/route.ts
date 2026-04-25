import { NextRequest, NextResponse } from 'next/server'
import { callAI } from '@/lib/ai'
import { AiMessage, OnboardingResult } from '@/types'
import { PROMPTS } from '@/lib/prompts'

function extractJson(text: string): string {
  // Try stripping markdown code block if present
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (codeBlockMatch) return codeBlockMatch[1].trim()
  // Try finding raw JSON object
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (jsonMatch) return jsonMatch[0]
  return text.trim()
}

export async function POST(req: NextRequest) {
  try {
    const { messages }: { messages: AiMessage[] } = await req.json()

    // 此路由已被 /api/profile/ai-chat 取代（v7 统一顾问模式）
    const content = await callAI(
      messages.map(m => ({ role: m.role, content: m.content })),
      PROMPTS.profile_advisor
        .replace('{profile_data}', '暂无数据')
        .replace('{report_nodes}', '暂无数据')
        .replace('{dimensions}', '暂无数据')
        .replace('{is_new_user}', 'true')
        .replace('{current_focus}', 'null')
    )

    let onboardingResult: OnboardingResult | null = null
    try {
      const parsed = JSON.parse(extractJson(content))
      if (parsed?.type === 'onboarding_result') {
        onboardingResult = parsed
      }
    } catch {
      // 正常对话文字，不是 JSON
    }

    // If it's an onboarding result, return clean content without the raw JSON
    const displayContent = onboardingResult
      ? 'AI 已帮你整理好了框架，请查看下方预览。'
      : content

    return NextResponse.json({ content: displayContent, onboardingResult })
  } catch {
    return NextResponse.json(
      { error: 'AI 服务暂时不可用，请稍后重试' },
      { status: 500 }
    )
  }
}
