'use client'

import { Dimension, LogFieldState } from '@/types'
import { buildDimensionTree } from '@/lib/dimensionUtils'

interface DimensionDirectoryProps {
  dimensions: Dimension[]
  fieldStates: Record<string, LogFieldState>
  activeLeafId: string | null
  onLeafClick: (id: string) => void
}

function getLeafIds(node: Dimension): string[] {
  if (node.level === 3) return [node.id]
  return (node.children ?? []).flatMap(getLeafIds)
}

function getFillStatus(
  node: Dimension,
  fieldStates: Record<string, LogFieldState>
): 'full' | 'partial' | 'empty' {
  const leafIds = getLeafIds(node)
  if (leafIds.length === 0) return 'empty'
  const filled = leafIds.filter(id => fieldStates[id]?.content?.trim()).length
  if (filled === 0) return 'empty'
  if (filled === leafIds.length) return 'full'
  return 'partial'
}

function FillDot({ status }: { status: 'full' | 'partial' | 'empty' }) {
  if (status === 'empty') {
    return (
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          borderTopWidth: '1.5px',
          borderTopStyle: 'solid',
          borderTopColor: '#D1CEC8',
          borderRightWidth: '1.5px',
          borderRightStyle: 'solid',
          borderRightColor: '#D1CEC8',
          borderBottomWidth: '1.5px',
          borderBottomStyle: 'solid',
          borderBottomColor: '#D1CEC8',
          borderLeftWidth: '1.5px',
          borderLeftStyle: 'solid',
          borderLeftColor: '#D1CEC8',
          display: 'inline-block',
          flexShrink: 0,
        }}
      />
    )
  }

  if (status === 'partial') {
    return (
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: '#9FE1CB',
          display: 'inline-block',
          flexShrink: 0,
        }}
      />
    )
  }

  return (
    <span
      style={{
        width: 6,
        height: 6,
        borderRadius: '50%',
        background: '#1D9E75',
        display: 'inline-block',
        flexShrink: 0,
      }}
    />
  )
}

export default function DimensionDirectory({
  dimensions,
  fieldStates,
  activeLeafId,
  onLeafClick,
}: DimensionDirectoryProps) {
  const tree = buildDimensionTree(dimensions)

  function handleClick(leafId: string) {
    onLeafClick(leafId)
    document.getElementById(`log-field-${leafId}`)?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    })
  }

  return (
    <div style={{ padding: '8px 0' }}>
      {tree.map(level1 => {
        const l1Status = getFillStatus(level1, fieldStates)

        return (
          <div key={level1.id} style={{ marginBottom: 4 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '6px 12px',
                cursor: 'default',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 13 }}>{level1.icon}</span>
                <span style={{ fontSize: 12, fontWeight: 500, color: '#1A1A1A' }}>
                  {level1.name}
                </span>
              </div>
              <FillDot status={l1Status} />
            </div>

            {(level1.children ?? []).map(level2 => {
              const l2Status = getFillStatus(level2, fieldStates)
              const firstLeafId = getLeafIds(level2)[0] ?? level2.id
              const isActive = level2.children?.some(l3 => l3.id === activeLeafId) ?? false

              return (
                <div
                  key={level2.id}
                  onClick={() => handleClick(firstLeafId)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '5px 12px 5px 26px',
                    cursor: 'pointer',
                    borderLeftWidth: '2px',
                    borderLeftStyle: 'solid',
                    borderLeftColor: isActive ? '#1D9E75' : 'transparent',
                    background: isActive ? '#F0FBF7' : 'transparent',
                    marginLeft: 2,
                  }}
                  onMouseEnter={e => {
                    if (!isActive) {
                      e.currentTarget.style.background = '#F4F3F0'
                    }
                  }}
                  onMouseLeave={e => {
                    if (!isActive) {
                      e.currentTarget.style.background = 'transparent'
                    }
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 10, color: '#B0ADA6' }}>▸</span>
                    <span
                      style={{
                        fontSize: 12,
                        color: isActive ? '#1D9E75' : l2Status !== 'empty' ? '#1A1A1A' : '#B0ADA6',
                      }}
                    >
                      {level2.name}
                    </span>
                  </div>
                  <FillDot status={l2Status} />
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
