import assert from 'node:assert/strict'
import test from 'node:test'

async function loadSummaryDimensionsModule() {
  try {
    return await import('../lib/summary-dimensions.ts')
  } catch {
    return {}
  }
}

test('expandSelectedDimensionIds includes descendants of selected parent dimensions', async () => {
  const mod = await loadSummaryDimensionsModule()

  assert.equal(typeof mod.expandSelectedDimensionIds, 'function')

  const expanded = mod.expandSelectedDimensionIds?.(
    ['finance'],
    [
      { id: 'finance', parent_id: null },
      { id: 'funding', parent_id: 'finance' },
      { id: 'forecast', parent_id: 'funding' },
      { id: 'ops', parent_id: null },
      { id: 'workflow', parent_id: 'ops' },
    ]
  )

  assert.deepEqual(expanded.sort(), ['finance', 'funding', 'forecast'].sort())
})

test('expandSelectedDimensionIds preserves direct leaf selections', async () => {
  const mod = await loadSummaryDimensionsModule()

  const expanded = mod.expandSelectedDimensionIds?.(
    ['forecast'],
    [
      { id: 'finance', parent_id: null },
      { id: 'funding', parent_id: 'finance' },
      { id: 'forecast', parent_id: 'funding' },
    ]
  )

  assert.deepEqual(expanded, ['forecast'])
})
