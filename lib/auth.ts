export type AuthMode = 'login' | 'signup'

const protectedPrefixes = ['/profile', '/log', '/summary'] as const

function matchesProtectedPrefix(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`)
}

export function isProtectedPath(pathname: string) {
  return protectedPrefixes.some((prefix) => matchesProtectedPrefix(pathname, prefix))
}

export function validateAuthForm(
  mode: AuthMode,
  password: string,
  confirmPassword?: string
) {
  if (mode !== 'signup') {
    return null
  }

  if (confirmPassword !== undefined && password !== confirmPassword) {
    return '两次输入的密码不一致'
  }

  if (password.length < 6) {
    return '密码至少需要 6 位'
  }

  return null
}

export function mapAuthErrorMessage(mode: AuthMode, message: string) {
  const normalizedMessage = message.toLowerCase()

  if (mode === 'signup') {
    if (normalizedMessage.includes('already registered')) {
      return '该邮箱已注册，请直接登录或使用其他邮箱'
    }

    return '注册失败，请稍后重试'
  }

  if (normalizedMessage.includes('not found')) {
    return '该邮箱尚未注册，请先注册'
  }

  if (
    normalizedMessage.includes('invalid login') ||
    normalizedMessage.includes('invalid credentials')
  ) {
    return '邮箱或密码错误，请重新输入'
  }

  return '登录失败，请稍后重试'
}
