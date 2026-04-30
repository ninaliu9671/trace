import { NextRequest, NextResponse } from 'next/server'
import { callAI } from '@/lib/ai'
import { PROMPTS } from '@/lib/prompts'
import { AiMessage, DimensionOperation, DimensionOpsPreview, ProfilePreview } from '@/types'
import {
  buildDimensionNumberMap,
  resolveDimensionOpTargets,
  validateAndNormalizeDimensionOps,
} from '@/lib/dimension-ops'

interface DimensionRef {
  n: string
  id: string
  name: string
}

function extractJson(text: string): string {
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (codeBlockMatch) return codeBlockMatch[1].trim()
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (jsonMatch) return jsonMatch[0]
  return text.trim()
}

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
      if (escaped) {
        escaped = false
      } else if (ch === '\\') {
        escaped = true
      } else if (ch === '"') {
        inString = false
      }
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

function parseDimensionOpsPreview(text: string): DimensionOpsPreview | null {
  try {
    const parsed = JSON.parse(extractJson(text))
    if (parsed?.type === 'dimension_ops_preview' && parsed?.target === 'dimension' && Array.isArray(parsed?.operations)) {
      return parsed as DimensionOpsPreview
    }
  } catch {
    // not valid JSON / not an ops preview
  }
  try {
    const balanced = extractBalancedJsonObject(text, '"dimension_ops_preview"')
      ?? extractBalancedJsonObject(text, '"operations"')
    if (balanced) {
      const parsed = JSON.parse(balanced)
      if (parsed?.type === 'dimension_ops_preview' && parsed?.target === 'dimension' && Array.isArray(parsed?.operations)) {
        return parsed as DimensionOpsPreview
      }
    }
  } catch {
    // balanced parse failed
  }
  try {
    const source = String(text || '')
    const opMatch = source.match(/"operations"\s*:\s*(\[[\s\S]*?\])/)
    if (!opMatch) return null
    const operations = JSON.parse(opMatch[1]) as DimensionOperation[]
    const resolvedMatch = source.match(/"resolved_targets"\s*:\s*(\[[\s\S]*?\])/)
    const warningsMatch = source.match(/"warnings"\s*:\s*(\[[\s\S]*?\])/)
    const resolvedTargets = resolvedMatch ? JSON.parse(resolvedMatch[1]) as string[] : []
    const warnings = warningsMatch ? JSON.parse(warningsMatch[1]) as string[] : []
    return {
      type: 'dimension_ops_preview',
      target: 'dimension',
      operations,
      resolved_targets: resolvedTargets,
      warnings,
    }
  } catch {
    // partial json parse failed
  }
  return null
}

interface FlatDimensionNode {
  id: string
  name: string
  level: 1 | 2 | 3
  parent_id: string | null
  sort_order: number
}

function parseDimensionNodes(dimensions: string): FlatDimensionNode[] {
  const lines = String(dimensions || '').split('\n')
  const nodes: FlatDimensionNode[] = []
  const stackByDepth: Array<{ id: string; level: 1 | 2 | 3 }> = []

  for (const line of lines) {
    const match = line.match(/^(\s*)\[N:([^\]]+)\]\[ID:([^\]]+)\]\s*(.+)$/)
    if (!match) continue
    const indent = match[1] ?? ''
    const id = match[3].trim()
    const name = match[4].replace(/（[^）]*）/g, '').trim()
    const level = (Math.floor(indent.length / 2) + 1) as 1 | 2 | 3
    const depth = Math.max(0, level - 1)
    stackByDepth.length = depth
    const parent = stackByDepth[depth - 1]
    const siblingCount = nodes.filter(n => n.parent_id === (parent?.id ?? null)).length
    nodes.push({
      id,
      name,
      level,
      parent_id: parent?.id ?? null,
      sort_order: siblingCount,
    })
    stackByDepth[depth] = { id, level }
  }
  return nodes
}

function parseDimensionRefs(dimensions: string): Map<string, DimensionRef> {
  const refs = new Map<string, DimensionRef>()
  const lines = String(dimensions || '').split('\n')
  for (const line of lines) {
    const match = line.match(/\[N:([^\]]+)\]\[ID:([^\]]+)\]\s*(.+)$/)
    if (!match) continue
    const n = match[1].trim()
    const id = match[2].trim()
    const name = match[3].replace(/（[^）]*）/g, '').trim()
    if (!n || !id || !name) continue
    refs.set(n, { n, id, name })
  }
  return refs
}

function extractIndexRefsFromLastUserMessage(messages: AiMessage[]): string[] {
  const lastUserContent = [...messages].reverse().find(m => m.role === 'user')?.content ?? ''
  const refs = lastUserContent.match(/\b\d+(?:\.\d+)*\b/g) ?? []
  return [...new Set(refs)]
}

function getLastUserMessage(messages: AiMessage[]): string {
  return [...messages].reverse().find(m => m.role === 'user')?.content ?? ''
}

function userExplicitlyConfirmed(messages: AiMessage[]): boolean {
  const lastUserContent = [...messages].reverse().find(m => m.role === 'user')?.content ?? ''
  return /(确认|可以|就这样|同意|没问题|按这个|采纳|生效|是的|好的|^ok$|^OK$|^yes$|^Yes$|^y$|^Y$)/.test(lastUserContent.trim())
}

function buildDimensionOpsConfirmText(opsPreview: DimensionOpsPreview): string {
  const lines: string[] = []
  const resolved = opsPreview.resolved_targets ?? []
  if (resolved.length > 0) {
    lines.push(`我理解你的调整是：${resolved.join('；')}`)
  } else {
    const raw = (opsPreview.operations ?? []).slice(0, 4).map(op => {
      if (op.op === 'add') return `新增「${op.name ?? '未命名维度'}」到 ${op.parent_n ?? '根节点'}`
      if (op.op === 'move') return `移动 ${op.target_n ?? op.target_id ?? '-'} 到 ${op.to_parent_n ?? op.to_parent_id ?? '根节点'}`
      if (op.op === 'update') return `编辑 ${op.target_n ?? op.target_id ?? '-'}`
      return `删除 ${op.target_n ?? op.target_id ?? '-'}`
    })
    if (raw.length > 0) lines.push(`我理解你的调整是：${raw.join('；')}`)
  }
  lines.push('如果没问题，请回复“确认”，我就生成采纳卡片。')
  return lines.join('\n')
}

function beautifyDimensionText(text: string): string {
  let out = String(text || '')
  out = out.replace(/N:\s*(\d+(?:\.\d+)*)/g, '$1')
  out = out.replace(/\bJSON\b/gi, '变更清单')
  out = out.replace(/\badd\b/gi, '新增')
  out = out.replace(/\bdelete\b/gi, '删除')
  out = out.replace(/\bupdate\b/gi, '修改')
  out = out.replace(/\bmove\b/gi, '移动')
  out = out.replace(/父级/g, '母级')
  out = out.replace(/父节点/g, '母节点')
  return out
}

function resolveMentionedDimensionsByName(
  userText: string,
  numberMap: ReturnType<typeof buildDimensionNumberMap>
): Array<{ n: string; name: string }> {
  const hits: Array<{ n: string; name: string }> = []
  for (const [n, name] of numberMap.numberToName.entries()) {
    if (name && userText.includes(name)) {
      hits.push({ n, name })
    }
  }
  return hits.sort((a, b) => a.n.length - b.n.length)
}

function flattenPreviewDimensionNames(preview: ProfilePreview): string[] {
  if (preview.target !== 'dimension') return []
  const names: string[] = []
  const walk = (nodes: Array<{ name: string; children?: Array<{ name: string; children?: unknown[] }> }>) => {
    for (const node of nodes) {
      names.push(node.name)
      if (node.children && node.children.length > 0) {
        walk(node.children as Array<{ name: string; children?: Array<{ name: string; children?: unknown[] }> }>)
      }
    }
  }
  walk((preview.content as Array<{ name: string; children?: Array<{ name: string; children?: unknown[] }> }>) ?? [])
  return names
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
    const indexRefs = extractIndexRefsFromLastUserMessage(messages)
    const lastUserMessage = getLastUserMessage(messages)
    const dimensionRefMap = parseDimensionRefs(dimensions)

    if (current_focus === 'dimension' && indexRefs.length > 0) {
      const invalidRefs = indexRefs.filter(ref => !dimensionRefMap.has(ref))
      if (invalidRefs.length > 0) {
        return NextResponse.json({
          content: `我没找到这些序号对应的维度：${invalidRefs.join('、')}。请确认序号后再说一次。`,
          profilePreview: null,
          dimensionOpsPreview: null,
        })
      }
    }

    const dimensionNodes = parseDimensionNodes(dimensions)
    const dimensionNumberMap = buildDimensionNumberMap(dimensionNodes)
    const mentionedByName = resolveMentionedDimensionsByName(lastUserMessage, dimensionNumberMap)

    if (
      current_focus === 'dimension' &&
      indexRefs.length === 0 &&
      mentionedByName.length === 1 &&
      /(新增|添加|增加|加一个|新建)/.test(lastUserMessage)
    ) {
      const m = mentionedByName[0]
      return NextResponse.json({
        content: `我理解你是要在 ${m.n} ${m.name} 下面新增维度。\n你希望新增的是同级项，还是在它下面再细分子项？如果没问题，也可以直接回复“确认”。`,
        profilePreview: null,
        dimensionOpsPreview: null,
      })
    }

    // First attempt
    const content = await callAI(aiMessages, systemPrompt)
    let profilePreview = parsePreview(content)
    let dimensionOpsPreview = parseDimensionOpsPreview(content)

    // Retry: AI announced a preview but didn't include JSON — ask it to output JSON directly
    if (!profilePreview && !dimensionOpsPreview && looksLikePreviewAnnouncement(content)) {
      const retryMessages: { role: 'user' | 'assistant'; content: string }[] = [
        ...aiMessages,
        { role: 'assistant', content },
        { role: 'user', content: '请直接输出 JSON，不要加任何其他文字。' },
      ]
      const retryContent = await callAI(retryMessages, systemPrompt, 0.3)
      const retryPreview = parsePreview(retryContent)
      const retryOpsPreview = parseDimensionOpsPreview(retryContent)
      if (retryPreview) {
        profilePreview = retryPreview
      }
      if (retryOpsPreview) {
        dimensionOpsPreview = retryOpsPreview
      }
    }

    // Dimension fallback: once user explicitly confirms, force model to output ops preview JSON
    if (current_focus === 'dimension' && !profilePreview && !dimensionOpsPreview && userExplicitlyConfirmed(messages)) {
      const retryMessages: { role: 'user' | 'assistant'; content: string }[] = [
        ...aiMessages,
        { role: 'assistant', content },
        {
          role: 'user',
          content:
            '请仅输出 dimension_ops_preview 的 JSON，不要任何解释文字。JSON 必须包含 type/target/operations/resolved_targets/warnings，且 operations 使用用户提到的序号。',
        },
      ]
      const forcedOpsContent = await callAI(retryMessages, systemPrompt, 0.2)
      dimensionOpsPreview = parseDimensionOpsPreview(forcedOpsContent)
      if (!dimensionOpsPreview) {
        profilePreview = parsePreview(forcedOpsContent)
      }
    }

    if (current_focus === 'dimension' && dimensionOpsPreview) {
      if (!userExplicitlyConfirmed(messages)) {
        return NextResponse.json({
          content: buildDimensionOpsConfirmText(dimensionOpsPreview),
          profilePreview: null,
          dimensionOpsPreview: null,
        })
      }

      const ops: DimensionOperation[] = (dimensionOpsPreview.operations ?? []).map(op => ({ ...op }))
      if (indexRefs.length > 0) {
        const normalizedRefs = new Set(indexRefs)
        for (const op of ops) {
          if (op.target_n && !normalizedRefs.has(op.target_n) && (op.op === 'delete' || op.op === 'move' || op.op === 'update')) {
            return NextResponse.json({
              content: `我检测到你这轮提到的是序号 ${indexRefs.join('、')}，但预览里包含了 ${op.target_n}。请你确认要调整的序号。`,
              profilePreview: null,
              dimensionOpsPreview: null,
            })
          }
        }
      }

      const validated = validateAndNormalizeDimensionOps(
        ops,
        dimensionNodes,
        dimensionNumberMap
      )

      if (validated.errors.length > 0) {
        return NextResponse.json({
          content: `我还不能生成可采纳预览：${validated.errors.join('；')}。请你明确序号或目标位置后我再生成。`,
          profilePreview: null,
          dimensionOpsPreview: null,
        })
      }

      const resolvedTargets = resolveDimensionOpTargets(validated.normalizedOps, dimensionNumberMap)
      const responsePreview: DimensionOpsPreview = {
        type: 'dimension_ops_preview',
        target: 'dimension',
        operations: validated.normalizedOps,
        resolved_targets: resolvedTargets,
        warnings: [...(dimensionOpsPreview.warnings ?? []), ...validated.warnings],
      }
      return NextResponse.json({
        content: '我按你的指令整理了维度调整操作，请先确认下方变更清单。',
        profilePreview: null,
        dimensionOpsPreview: responsePreview,
      })
    }

    if (current_focus === 'dimension' && userExplicitlyConfirmed(messages) && !profilePreview && !dimensionOpsPreview) {
      return NextResponse.json({
        content: '我还没有成功生成可采纳的变更卡片。请再回复一次“确认按刚才的变更生成采纳卡”。',
        profilePreview: null,
        dimensionOpsPreview: null,
      })
    }

    if (profilePreview?.target === 'dimension' && indexRefs.length > 0) {
      const expectedNames = indexRefs
        .map(ref => dimensionRefMap.get(ref))
        .filter((x): x is DimensionRef => Boolean(x))
        .map(x => x.name)
      const previewNames = flattenPreviewDimensionNames(profilePreview)
      const missingNames = expectedNames.filter(name => !previewNames.includes(name))
      if (missingNames.length > 0) {
        return NextResponse.json({
          content: `我理解你提到的维度是：${expectedNames.join('、')}。当前预览未覆盖：${missingNames.join('、')}，请再确认你的删除/调整意图。`,
          profilePreview: null,
          dimensionOpsPreview: null,
        })
      }
    }

    const targetLabel =
      profilePreview?.target === 'profile' ? '职业画像'
      : profilePreview?.target === 'report' ? '汇报框架'
      : '记录维度'

    const displayContent = profilePreview
      ? `已帮你整理好了${targetLabel}的内容，请查看下方预览。`
      : (
        current_focus === 'dimension' && /"type"\s*:\s*"dimension_ops_preview"/.test(content)
          ? '我已整理好变更清单，请确认后我会生成采纳卡。'
          : (current_focus === 'dimension' ? beautifyDimensionText(content) : content)
      )

    return NextResponse.json({ content: displayContent, profilePreview, dimensionOpsPreview: null })
  } catch {
    return NextResponse.json({ error: 'AI 服务暂时不可用，请稍后重试' }, { status: 500 })
  }
}
