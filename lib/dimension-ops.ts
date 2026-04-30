import { Dimension, DimensionOperation } from '@/types'
import { buildDimensionTree } from '@/lib/dimensionUtils'

type DimensionLike = Pick<Dimension, 'id' | 'name' | 'level' | 'parent_id' | 'sort_order'> & Partial<Dimension>

export interface DimensionNumberMap {
  numberToId: Map<string, string>
  idToNumber: Map<string, string>
  numberToName: Map<string, string>
}

export interface DimensionOpsValidationResult {
  errors: string[]
  warnings: string[]
  normalizedOps: DimensionOperation[]
}

export function buildDimensionNumberMap(dimensions: DimensionLike[]): DimensionNumberMap {
  const tree = buildDimensionTree(dimensions as Dimension[])
  const numberToId = new Map<string, string>()
  const idToNumber = new Map<string, string>()
  const numberToName = new Map<string, string>()

  function walk(nodes: Dimension[], prefix = '') {
    nodes.forEach((node, index) => {
      const n = prefix ? `${prefix}.${index + 1}` : `${index + 1}`
      numberToId.set(n, node.id)
      idToNumber.set(node.id, n)
      numberToName.set(n, node.name)
      if (node.children && node.children.length > 0) walk(node.children, n)
    })
  }

  walk(tree)
  return { numberToId, idToNumber, numberToName }
}

function buildChildrenMap(dimensions: DimensionLike[]): Map<string, string[]> {
  const map = new Map<string, string[]>()
  for (const dim of dimensions) {
    if (!dim.parent_id) continue
    const list = map.get(dim.parent_id) ?? []
    list.push(dim.id)
    map.set(dim.parent_id, list)
  }
  return map
}

function collectDescendants(id: string, childrenMap: Map<string, string[]>): Set<string> {
  const descendants = new Set<string>()
  const stack = [...(childrenMap.get(id) ?? [])]
  while (stack.length > 0) {
    const cur = stack.pop()
    if (!cur || descendants.has(cur)) continue
    descendants.add(cur)
    stack.push(...(childrenMap.get(cur) ?? []))
  }
  return descendants
}

export function validateAndNormalizeDimensionOps(
  operations: DimensionOperation[],
  dimensions: DimensionLike[],
  numberMap: DimensionNumberMap
): DimensionOpsValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  const normalizedOps: DimensionOperation[] = []
  const dimById = new Map(dimensions.map(d => [d.id, d]))
  const childrenMap = buildChildrenMap(dimensions)
  const pendingAddTargets = new Set(
    operations
      .filter(op => op.op === 'add' && op.target_n)
      .map(op => String(op.target_n))
  )

  for (const op of operations) {
    const normalized: DimensionOperation = { ...op }

    if (op.target_n && !op.target_id) normalized.target_id = numberMap.numberToId.get(op.target_n)
    if (op.parent_n !== undefined && !op.parent_id && op.parent_n !== null) normalized.parent_id = numberMap.numberToId.get(op.parent_n)
    if (op.to_parent_n !== undefined && !op.to_parent_id && op.to_parent_n !== null) normalized.to_parent_id = numberMap.numberToId.get(op.to_parent_n)

    if (op.op === 'delete' || op.op === 'update' || op.op === 'move') {
      if (!normalized.target_id) {
        errors.push(`操作 ${op.op} 缺少有效目标序号/ID`)
      } else if (!dimById.has(normalized.target_id)) {
        errors.push(`目标不存在：${op.target_n ?? normalized.target_id}`)
      }
    }

    if (op.op === 'add') {
      if (!op.name) errors.push('新增操作缺少 name')
      const parentCanBeDeferred = Boolean(op.parent_n && pendingAddTargets.has(op.parent_n))
      if (!normalized.parent_id && op.parent_n !== null && op.parent_id !== null && !parentCanBeDeferred) {
        errors.push(`新增操作母级不存在：${op.parent_n ?? op.parent_id}`)
      }
      if (op.level && (op.level < 1 || op.level > 3)) errors.push('新增操作 level 非法')
    }

    if (op.op === 'move' && normalized.target_id) {
      if (normalized.to_parent_id && !dimById.has(normalized.to_parent_id)) {
        errors.push(`移动目标母级不存在：${op.to_parent_n ?? normalized.to_parent_id}`)
      } else if (normalized.to_parent_id) {
        const descendants = collectDescendants(normalized.target_id, childrenMap)
        if (descendants.has(normalized.to_parent_id)) {
          errors.push(`不能把节点移动到自己的子孙节点下：${op.target_n ?? normalized.target_id}`)
        }
      }
    }

    if (op.op === 'update' && !op.fields && !op.name && !op.icon && op.prompt_text === undefined) {
      warnings.push(`更新操作未提供可修改字段：${op.target_n ?? op.target_id ?? ''}`)
    }

    normalizedOps.push(normalized)
  }

  return { errors, warnings, normalizedOps }
}

export function resolveDimensionOpTargets(
  operations: DimensionOperation[],
  numberMap: DimensionNumberMap
): string[] {
  const labels: string[] = []
  for (const op of operations) {
    if (op.op === 'add') {
      const parentLabel = op.parent_n ? `${op.parent_n} ${numberMap.numberToName.get(op.parent_n) ?? ''}`.trim() : '顶层'
      labels.push(`新增「${op.name ?? '未命名维度'}」到 ${parentLabel}`)
      continue
    }
    const targetN = op.target_n ?? (op.target_id ? numberMap.idToNumber.get(op.target_id) : undefined)
    const targetName = targetN ? numberMap.numberToName.get(targetN) : undefined
    const base = `${targetN ?? '-'} ${targetName ?? ''}`.trim()
    if (op.op === 'move') {
      const toN = op.to_parent_n ?? (op.to_parent_id ? numberMap.idToNumber.get(op.to_parent_id) : undefined) ?? '顶层'
      labels.push(`将 ${base} 移到 ${toN}`)
    } else if (op.op === 'update') {
      labels.push(`修改 ${base}`)
    } else if (op.op === 'delete') {
      labels.push(`删除 ${base}（及子项）`)
    }
  }
  return labels
}
