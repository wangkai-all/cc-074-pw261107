import type { AppStatus, EffectiveStatus, GrantStatus, Sensitivity } from './types'
import { SENS_META } from './utils/format'

export const APP_STATUS_LABEL: Record<AppStatus, { text: string; tone: 'neutral' | 'blue' | 'amber' | 'red' | 'green' | 'purple' }> = {
  pending: { text: '待审批', tone: 'amber' },
  approved: { text: '已批准', tone: 'green' },
  rejected: { text: '已驳回', tone: 'red' },
  revoked: { text: '已撤销', tone: 'neutral' },
  duplicate: { text: '重复合并', tone: 'purple' },
  cancelled: { text: '已撤回', tone: 'neutral' },
}

export const GRANT_STATUS_LABEL: Record<GrantStatus | 'invalid', { text: string; tone: 'neutral' | 'blue' | 'amber' | 'red' | 'green' | 'purple' }> = {
  active: { text: '生效中', tone: 'green' },
  expired: { text: '已到期', tone: 'neutral' },
  revoked: { text: '已撤销', tone: 'red' },
  reconfirming: { text: '待重新确认', tone: 'amber' },
  superseded: { text: '已被新版本取代', tone: 'purple' },
  invalid: { text: '失效', tone: 'red' },
}

export const FIELD_STATUS_LABEL = {
  active: { text: '在用', tone: 'green' as const },
  modified: { text: '已变更', tone: 'amber' as const },
  deleted: { text: '已删除', tone: 'red' as const },
}

export function sensBadge(s: Sensitivity) {
  return { text: SENS_META[s].label, tone: SENS_META[s].tone }
}

export function appStatusLabel(s: AppStatus) {
  return APP_STATUS_LABEL[s]
}
export function grantStatusLabel(s: EffectiveStatus) {
  return GRANT_STATUS_LABEL[s] ?? GRANT_STATUS_LABEL.invalid
}
