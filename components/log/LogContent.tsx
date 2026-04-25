'use client'

import { Dimension, LogFieldState } from '@/types'
import { buildDimensionTree } from '@/lib/dimensionUtils'
import LogField from '@/components/log/LogField'

interface LogContentProps {
  dimensions: Dimension[]
  fieldStates: Record<string, LogFieldState>
  locked: boolean
  activeLeafId: string | null
  onFieldChange: (dimensionId: string, content: string, isAiFilled?: boolean) => void
}

function collectLeaves(
  node: Dimension,
  path: string[] = []
): { leaf: Dimension; path: string[] }[] {
  if (node.level === 3) return [{ leaf: node, path }]
  return (node.children ?? []).flatMap(child => collectLeaves(child, [...path, node.name]))
}

export default function LogContent({
  dimensions,
  fieldStates,
  locked,
  activeLeafId,
  onFieldChange,
}: LogContentProps) {
  const tree = buildDimensionTree(dimensions)

  if (dimensions.length === 0) {
    return (
      <div style={{ padding: 24, color: '#B0ADA6', fontSize: 13 }}>
        还没有设置记录维度，请先到职业档案完善维度设置。
      </div>
    )
  }

  return (
    <div style={{ padding: '24px' }}>
      {tree.map(level1 => {
        const leaves = collectLeaves(level1)
        if (leaves.length === 0) return null

        return (
          <div key={level1.id} style={{ marginBottom: 32 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 16,
                paddingBottom: 8,
                borderBottomWidth: '1px',
                borderBottomStyle: 'solid',
                borderBottomColor: '#F0EDE8',
              }}
            >
              <span style={{ fontSize: 15 }}>{level1.icon}</span>
              <span style={{ fontSize: 13, fontWeight: 500, color: '#6B6B6B' }}>
                {level1.name}
              </span>
            </div>

            {leaves.map(({ leaf }) => (
              <LogField
                key={leaf.id}
                dimension={leaf}
                fieldState={fieldStates[leaf.id] ?? { content: '', isAiFilled: false }}
                locked={locked}
                isActive={activeLeafId === leaf.id}
                onChange={(content, isAiFilled) => onFieldChange(leaf.id, content, isAiFilled)}
              />
            ))}
          </div>
        )
      })}
    </div>
  )
}
