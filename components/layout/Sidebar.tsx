'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const navItems = [
  { href: '/profile', icon: '◉', label: '职业档案' },
  { href: '/log', icon: '✦', label: '工作日志' },
  { href: '/summary', icon: '◫', label: '汇报总结' },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const profileIncomplete = true

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <aside className="flex w-[172px] shrink-0 flex-col border-r border-[#E0DDD6] bg-[#EDEAE4]">
      <div className="border-b border-[#E0DDD6] px-[15px] pb-[12px] pt-[15px]">
        <div className="text-[15px] font-medium text-[#1A1A1A]">
          Trace <span className="text-[#1D9E75]">履迹</span>
        </div>
      </div>

      <nav className="flex-1 px-[8px] py-[8px]">
        <div className="space-y-[6px]">
          {navItems.map((item) => {
            const isActive = pathname === item.href

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-[8px] rounded-[7px] px-[10px] py-[7px] text-[13px] ${
                  isActive
                    ? 'bg-[#1D9E75] text-white hover:bg-[#1D9E75]'
                    : 'text-[#6B6B6B] hover:bg-[#E4E0D8]'
                }`}
              >
                <span className="w-[16px] text-center text-[14px]">{item.icon}</span>
                <span>{item.label}</span>
                {item.href === '/profile' && profileIncomplete ? (
                  <span className="ml-auto h-[7px] w-[7px] rounded-full bg-[#F59E0B]" />
                ) : null}
              </Link>
            )
          })}
        </div>
      </nav>

      <div className="border-t border-[#E0DDD6] px-[8px] py-[10px]">
        <div className="flex items-center gap-[8px] rounded-[7px] px-[10px] py-[7px]">
          <div className="flex h-[28px] w-[28px] shrink-0 items-center justify-center rounded-full bg-white text-[12px] text-[#6B6B6B]">
            N
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[12px] font-medium text-[#1A1A1A]">Nina</div>
            <div className="truncate text-[11px] text-[#6B6B6B]">已登录用户</div>
          </div>
          <button
            onClick={handleSignOut}
            title="退出登录"
            className="shrink-0 rounded-[5px] px-[6px] py-[4px] text-[11px] text-[#B0ADA6] hover:bg-[#E4E0D8] hover:text-[#6B6B6B]"
          >
            退出
          </button>
        </div>
      </div>
    </aside>
  )
}
