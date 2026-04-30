import assert from 'node:assert/strict'
import test from 'node:test'

async function loadSummaryResultModule() {
  try {
    return await import('../lib/summary-result.ts')
  } catch {
    return {}
  }
}

test('normalizeCompletenessResult returns safe arrays for error-shaped responses', async () => {
  const mod = await loadSummaryResultModule()

  assert.equal(typeof mod.normalizeCompletenessResult, 'function')

  const result = mod.normalizeCompletenessResult?.({ error: '检查失败，请稍后重试' })

  assert.deepEqual(result, {
    completeness: 'logs_only',
    found_summaries: [],
    missing_types: [],
    logs_count: 0,
  })
})

test('isCompletenessResult rejects responses without summary arrays', async () => {
  const mod = await loadSummaryResultModule()

  assert.equal(typeof mod.isCompletenessResult, 'function')
  assert.equal(mod.isCompletenessResult?.({ error: '检查失败，请稍后重试' }), false)
  assert.equal(mod.isCompletenessResult?.({
    completeness: 'partial',
    found_summaries: [],
    missing_types: [],
    logs_count: 3,
  }), true)
})
