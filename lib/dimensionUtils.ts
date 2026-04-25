import { Dimension } from '@/types'

export function buildDimensionTree(dims: Dimension[]): Dimension[] {
  const map: Record<string, Dimension> = {}
  const roots: Dimension[] = []

  for (const dim of dims) {
    map[dim.id] = { ...dim, children: [] }
  }

  for (const dim of Object.values(map)) {
    if (dim.parent_id && map[dim.parent_id]) {
      map[dim.parent_id].children!.push(dim)
    } else {
      roots.push(dim)
    }
  }

  function sortChildren(d: Dimension) {
    d.children?.sort((a, b) => a.sort_order - b.sort_order)
    d.children?.forEach(sortChildren)
  }

  roots.sort((a, b) => a.sort_order - b.sort_order)
  roots.forEach(sortChildren)

  return roots
}
