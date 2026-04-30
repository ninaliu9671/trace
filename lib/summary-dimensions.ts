interface DimensionLike {
  id: string
  parent_id: string | null
}

export function expandSelectedDimensionIds(
  selectedIds: string[],
  dimensions: DimensionLike[]
): string[] {
  if (selectedIds.length === 0) return []

  const selected = new Set(selectedIds)
  const childrenByParent = new Map<string, string[]>()

  for (const dimension of dimensions) {
    if (!dimension.parent_id) continue
    const children = childrenByParent.get(dimension.parent_id) ?? []
    children.push(dimension.id)
    childrenByParent.set(dimension.parent_id, children)
  }

  const expanded = new Set<string>()
  const stack = [...selectedIds]

  while (stack.length > 0) {
    const id = stack.pop()
    if (!id || expanded.has(id)) continue
    expanded.add(id)

    for (const childId of childrenByParent.get(id) ?? []) {
      if (!expanded.has(childId)) stack.push(childId)
    }
  }

  return [...expanded].filter(id => selected.has(id) || dimensions.some(d => d.id === id))
}
