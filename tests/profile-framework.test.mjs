import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const rootDir = path.resolve(import.meta.dirname, '..')

async function readProjectFile(relativePath) {
  return readFile(path.join(rootDir, relativePath), 'utf8')
}

test('root layout uses DM Sans metadata and zh-CN locale', async () => {
  const source = await readProjectFile('app/layout.tsx')

  assert.match(source, /DM_Sans/)
  assert.match(source, /--font-dm-sans/)
  assert.match(source, /lang="zh-CN"|lang='zh-CN'/)
  assert.match(source, /title:\s*'Trace 履迹'|title:\s*"Trace 履迹"/)
  assert.match(source, /description:\s*'随手记录每天的工作，AI 整理成随时可用的汇报总结'|description:\s*"随手记录每天的工作，AI 整理成随时可用的汇报总结"/)
})

test('global styles use Task 01 design tokens while keeping Tailwind v4 import', async () => {
  const source = await readProjectFile('app/globals.css')

  assert.match(source, /@import\s+"tailwindcss";/)
  assert.match(source, /box-sizing:\s*border-box/)
  assert.match(source, /background-color:\s*#F8F7F4/i)
  assert.match(source, /color:\s*#1A1A1A/i)
  assert.match(source, /font-family:\s*var\(--font-dm-sans\), system-ui/i)
  assert.match(source, /::-webkit-scrollbar/)
  assert.match(source, /background:\s*#E8E4DD/i)
})

test('sidebar component renders fixed navigation and profile reminder dot', async () => {
  const source = await readProjectFile('components/layout/Sidebar.tsx')

  assert.match(source, /'use client'/)
  assert.match(source, /usePathname\(/)
  assert.match(source, /w-\[172px\]/)
  assert.match(source, /bg-\[#EDEAE4\]/)
  assert.match(source, /Trace/)
  assert.match(source, /履迹/)
  assert.match(source, /\/profile/)
  assert.match(source, /\/log/)
  assert.match(source, /\/summary/)
  assert.match(source, /bg-\[#1D9E75\]/)
  assert.match(source, /bg-\[#F59E0B\]/)
  assert.match(source, /usePathname/)
})

test('profile page provides sidebar tabs ai trigger and bottom status bar', async () => {
  const source = await readProjectFile('app/profile/page.tsx')

  assert.match(source, /'use client'/)
  assert.match(source, /Sidebar/)
  assert.match(source, /useState\(/)
  assert.match(source, /职业档案/)
  assert.match(source, /职业画像/)
  assert.match(source, /汇报框架/)
  assert.match(source, /记录维度/)
  assert.match(source, /console\.log\(/)
  assert.match(source, /✦ AI 助手/)
  assert.match(source, /档案尚未完善/)
  assert.match(source, /待完善/)
  assert.match(source, /bg-\[#F8F7F4\]/)
})

test('root page still uses server-side auth redirect instead of task doc placeholder', async () => {
  const source = await readProjectFile('app/page.tsx')

  assert.match(source, /createSessionClient/)
  assert.match(source, /auth\.getUser\(/)
  assert.match(source, /redirect\('\/profile'\)|redirect\("\/profile"\)/)
  assert.match(source, /redirect\('\/login'\)|redirect\("\/login"\)/)
})

test('ai prompt and shared type files exist for later tasks', async () => {
  const promptsSource = await readProjectFile('lib/prompts.ts')
  const typesSource = await readProjectFile('types/index.ts')
  const aiSource = await readProjectFile('lib/ai.ts')

  assert.match(promptsSource, /export const PROMPTS/)
  assert.match(promptsSource, /profile_new_user/)
  assert.match(promptsSource, /profile_existing/)
  assert.match(aiSource, /callAI/)
  assert.match(aiSource, /callAIStream/)
  assert.match(aiSource, /deepseek-chat/)
  assert.match(typesSource, /export interface UserProfile/)
  assert.match(typesSource, /export interface ReportNode/)
  assert.match(typesSource, /export interface Dimension/)
  assert.match(typesSource, /export interface AiMessage/)
})
