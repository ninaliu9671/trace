import type { CompletenessResult } from '@/types'

const EMPTY_COMPLETENESS_RESULT: CompletenessResult = {
  completeness: 'logs_only',
  found_summaries: [],
  missing_types: [],
  logs_count: 0,
}

export function isCompletenessResult(value: unknown): value is CompletenessResult {
  if (!value || typeof value !== 'object') return false

  const result = value as Partial<CompletenessResult>
  return (
    (result.completeness === 'complete' ||
      result.completeness === 'partial' ||
      result.completeness === 'logs_only') &&
    Array.isArray(result.found_summaries) &&
    Array.isArray(result.missing_types) &&
    typeof result.logs_count === 'number'
  )
}

export function normalizeCompletenessResult(value: unknown): CompletenessResult {
  if (!value || typeof value !== 'object') return EMPTY_COMPLETENESS_RESULT

  const result = value as Partial<CompletenessResult>
  return {
    completeness:
      result.completeness === 'complete' ||
      result.completeness === 'partial' ||
      result.completeness === 'logs_only'
        ? result.completeness
        : 'logs_only',
    found_summaries: Array.isArray(result.found_summaries) ? result.found_summaries : [],
    missing_types: Array.isArray(result.missing_types) ? result.missing_types : [],
    logs_count: typeof result.logs_count === 'number' ? result.logs_count : 0,
  }
}
