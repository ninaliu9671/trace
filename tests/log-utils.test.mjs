import assert from 'node:assert/strict'
import test from 'node:test'

async function loadUtilsModule() {
  try {
    return await import('../lib/utils.ts')
  } catch {
    return {}
  }
}

test('toDateString formats date as YYYY-MM-DD with zero padding', async () => {
  const utils = await loadUtilsModule()

  assert.equal(typeof utils.toDateString, 'function')
  assert.equal(utils.toDateString?.(new Date(2026, 0, 5)), '2026-01-05')
  assert.equal(utils.toDateString?.(new Date(2026, 10, 23)), '2026-11-23')
})
