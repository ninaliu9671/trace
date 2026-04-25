import assert from 'node:assert/strict'
import test from 'node:test'

async function loadAuthModule() {
  try {
    return await import('../lib/auth.ts')
  } catch {
    return {}
  }
}

test('signup duplicate email shows the expected message', async () => {
  const auth = await loadAuthModule()

  assert.equal(typeof auth.mapAuthErrorMessage, 'function')
  assert.equal(
    auth.mapAuthErrorMessage?.('signup', 'User already registered'),
    '该邮箱已注册，请直接登录或使用其他邮箱'
  )
})

test('signup password mismatch is validated before submitting', async () => {
  const auth = await loadAuthModule()

  assert.equal(typeof auth.validateAuthForm, 'function')
  assert.equal(
    auth.validateAuthForm?.('signup', '123456', '654321'),
    '两次输入的密码不一致'
  )
})

test('signup password length requires at least six characters', async () => {
  const auth = await loadAuthModule()

  assert.equal(typeof auth.validateAuthForm, 'function')
  assert.equal(
    auth.validateAuthForm?.('signup', '12345', '12345'),
    '密码至少需要 6 位'
  )
})

test('login invalid credentials map to the expected message', async () => {
  const auth = await loadAuthModule()

  assert.equal(typeof auth.mapAuthErrorMessage, 'function')
  assert.equal(
    auth.mapAuthErrorMessage?.('login', 'Invalid login credentials'),
    '邮箱或密码错误，请重新输入'
  )
})

test('protected path matcher covers profile, log, and summary routes', async () => {
  const auth = await loadAuthModule()

  assert.equal(typeof auth.isProtectedPath, 'function')
  assert.equal(auth.isProtectedPath?.('/profile'), true)
  assert.equal(auth.isProtectedPath?.('/log/2026-04-24'), true)
  assert.equal(auth.isProtectedPath?.('/summary'), true)
  assert.equal(auth.isProtectedPath?.('/login'), false)
  assert.equal(auth.isProtectedPath?.('/profiles'), false)
})
