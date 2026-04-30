export interface UserProfile {
  id: string
  job_title: string | null
  industry: string | null
  work_years: number | null
  company_size: string | null
  job_responsibilities: string | null
  career_direction: string | null
  skill_focus: string | null
  onboarding_completed: boolean
}

export interface ReportModule {
  id: string
  name: string
  description: string
}

export interface ReportNode {
  id: string
  user_id: string
  name: string
  audience: string | null
  modules: ReportModule[]
  sort_order: number
  is_active: boolean
  style: string | null
  children?: ReportNode[]
  // kept optional for backward-compat with existing data and tree logic
  trigger_desc?: string | null
  time_granularity?: string | null
  parent_id?: string | null
}

export interface Dimension {
  id: string
  user_id: string
  name: string
  icon: string
  level: number
  parent_id: string | null
  sort_order: number
  prompt_text: string | null
  is_active: boolean
  children?: Dimension[]
}

export interface DailyLog {
  id: string
  user_id: string
  log_date: string
  dimension_id: string
  content: string
  word_count: number | null
  is_ai_generated: boolean
  created_at?: string
  updated_at?: string
}

export interface LogFieldState {
  content: string
  isAiFilled: boolean
}

export interface LogPreviewItem {
  dimension_id: string
  dimension_name: string
  content: string
}

export interface LogPreview {
  type: 'log_preview'
  items: LogPreviewItem[]
}

export interface DataSources {
  summaries_used?: string[]
  logs_count?: number
  completeness?: 'complete' | 'partial' | 'logs_only'
  dimension_names?: string[]
  report_node_name?: string
}

export interface Summary {
  id: string
  user_id: string
  created_at: string
  updated_at: string
  date_from: string            // 'YYYY-MM-DD'
  date_to: string              // 'YYYY-MM-DD'
  summary_type: 'weekly' | 'monthly' | 'quarterly' | 'annual' | 'adhoc'
  title: string | null
  content: string              // Markdown
  report_node_id: string | null
  data_sources: DataSources
  is_draft: boolean
  finalized_at: string | null
  // 关联查询带入（非数据库字段）
  dimension_names?: string[]
}

export interface CompletenessResult {
  completeness: 'complete' | 'partial' | 'logs_only'
  found_summaries: {
    type: string
    count: number
    label: string
  }[]
  missing_types: {
    type: string
    label: string
  }[]
  logs_count: number
}

// 新建总结弹窗参数（Task 14 用）
export interface NewSummaryParams {
  dateFrom: string
  dateTo: string
  summaryType: Summary['summary_type']
  dimensionIds: string[]       // 选中的维度 id 列表
  reportNodeId: string | null  // 套用的汇报框架节点 id
}

export interface AiConversationState {
  hasMessages: boolean
  isEnded: boolean
  hasPendingPreview: boolean
}

// v7: per-part profile preview from unified AI advisor
export type ProfilePreviewTarget = 'profile' | 'report' | 'dimension'

export interface ProfilePreviewProfileContent {
  job_title?: string
  industry?: string
  work_years?: number
  company_size?: string
  job_responsibilities?: string
  career_direction?: string
  skill_focus?: string
}

export interface ProfilePreviewReportNode {
  name: string
  audience?: string | null
  style?: string | null
  modules?: ReportModule[]
}

export interface ProfilePreviewDimension {
  name: string
  icon?: string
  level: number
  prompt_text?: string
  children?: ProfilePreviewDimension[]
}

export interface ProfilePreview {
  type: 'profile_preview'
  target: ProfilePreviewTarget
  content: ProfilePreviewProfileContent | ProfilePreviewReportNode[] | ProfilePreviewDimension[]
}

export type DimensionOpType = 'add' | 'delete' | 'update' | 'move'

export interface DimensionOperation {
  op: DimensionOpType
  target_n?: string
  target_id?: string
  parent_n?: string | null
  parent_id?: string | null
  to_parent_n?: string | null
  to_parent_id?: string | null
  to_index?: number
  level?: number
  name?: string
  icon?: string
  prompt_text?: string | null
  fields?: Partial<Pick<Dimension, 'name' | 'icon' | 'prompt_text'>>
}

export interface DimensionOpsPreview {
  type: 'dimension_ops_preview'
  target: 'dimension'
  operations: DimensionOperation[]
  resolved_targets?: string[]
  warnings?: string[]
}

export interface ReplaceSuggestion {
  type: 'replace_suggestion'
  target_section: string
  original: string
  replacement: string
}

export interface AiMessage {
  role: 'user' | 'assistant'
  content: string
  messageType?: 'text' | 'onboarding_result' | 'profile_preview' | 'dimension_ops_preview' | 'log_preview' | 'replace_suggestion'
  onboardingData?: OnboardingResult
  profilePreview?: ProfilePreview
  dimensionOpsPreviewData?: DimensionOpsPreview
  logPreviewData?: LogPreview
  replaceSuggestionData?: ReplaceSuggestion
  confirmed?: boolean
  discarded?: boolean
}

export interface OnboardingResult {
  type: 'onboarding_result'
  report_nodes: OnboardingReportNode[]
  dimensions: OnboardingDimension[]
}

export interface OnboardingReportNode {
  name: string
  audience: string | null
  style: string | null
  modules: ReportModule[]
}

export interface OnboardingDimension {
  name: string
  icon: string
  level: number
  prompt_text?: string
  children?: OnboardingDimension[]
}
