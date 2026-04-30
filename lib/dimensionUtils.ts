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

export interface NumberedDimension {
  n: string
  id: string
  name: string
  level: number
  parent_id: string | null
}

export function buildNumberedDimensions(dims: Dimension[]): NumberedDimension[] {
  const tree = buildDimensionTree(dims)
  const out: NumberedDimension[] = []

  function walk(nodes: Dimension[], prefix = '') {
    nodes.forEach((node, index) => {
      const n = prefix ? `${prefix}.${index + 1}` : `${index + 1}`
      out.push({
        n,
        id: node.id,
        name: node.name,
        level: node.level,
        parent_id: node.parent_id,
      })
      if (node.children && node.children.length > 0) walk(node.children, n)
    })
  }

  walk(tree)
  return out
}
