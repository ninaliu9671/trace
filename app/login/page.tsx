'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { mapAuthErrorMessage, type AuthMode, validateAuthForm } from '@/lib/auth'

const supabase = createClient()

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<AuthMode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage('')

    const validationMessage = validateAuthForm(mode, password, confirmPassword)
    if (validationMessage) {
      setErrorMessage(validationMessage)
      return
    }

    setIsSubmitting(true)

    if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({
        email,
        password,
      })

      if (error) {
        setErrorMessage(mapAuthErrorMessage(mode, error.message))
        setIsSubmitting(false)
        return
      }

      router.push('/profile')
      router.refresh()
      return
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setErrorMessage(mapAuthErrorMessage(mode, error.message))
      setIsSubmitting(false)
      return
    }

    router.push('/profile')
    router.refresh()
  }

  return (
    <main
      className="flex min-h-screen items-center justify-center bg-[#F8F7F4] px-4"
      style={{ fontFamily: 'DM Sans, system-ui, sans-serif' }}
    >
      <section className="w-full max-w-[380px] rounded-2xl border border-[#E8E4DD] bg-white p-6">
        <div className="grid grid-cols-2 rounded-full border border-[#E8E4DD] bg-[#F8F7F4] p-1 text-sm">
          <button
            type="button"
            className={`rounded-full px-4 py-2 transition ${
              mode === 'login' ? 'bg-[#1D9E75] text-white' : 'text-[#6B6B6B]'
            }`}
            onClick={() => {
              setMode('login')
              setErrorMessage('')
            }}
          >
            登录
          </button>
          <button
            type="button"
            className={`rounded-full px-4 py-2 transition ${
              mode === 'signup' ? 'bg-[#1D9E75] text-white' : 'text-[#6B6B6B]'
            }`}
            onClick={() => {
              setMode('signup')
              setErrorMessage('')
            }}
          >
            注册
          </button>
        </div>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <label className="block space-y-2 text-sm text-[#6B6B6B]">
            <span>邮箱</span>
            <input
              required
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-xl border border-[#E8E4DD] bg-white px-4 py-3 text-black outline-none"
              placeholder="name@example.com"
            />
          </label>

          <label className="block space-y-2 text-sm text-[#6B6B6B]">
            <span>密码</span>
            <input
              required
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-xl border border-[#E8E4DD] bg-white px-4 py-3 text-black outline-none"
              placeholder="请输入密码"
            />
          </label>

          {mode === 'signup' ? (
            <label className="block space-y-2 text-sm text-[#6B6B6B]">
              <span>确认密码</span>
              <input
                required
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="w-full rounded-xl border border-[#E8E4DD] bg-white px-4 py-3 text-black outline-none"
                placeholder="请再次输入密码"
              />
            </label>
          ) : null}

          {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-xl bg-[#1D9E75] px-4 py-3 text-sm font-medium text-white disabled:opacity-60"
          >
            {isSubmitting ? '处理中...' : mode === 'login' ? '登录' : '注册'}
          </button>
        </form>
      </section>
    </main>
  )
}
