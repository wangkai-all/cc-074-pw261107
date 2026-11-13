// ===================== 领域模型 =====================

export type Sensitivity = 'L1' | 'L2' | 'L3' | 'L4'

export type FieldStatus = 'active' | 'modified' | 'deleted'

export type ConsumerKind = 'report' | 'task'

export type AppStatus =
  | 'pending'        // 待审批
  | 'approved'       // 已批准（可能已被后续授权取代）
  | 'rejected'       // 已驳回
  | 'revoked'        // 已撤销
  | 'duplicate'      // 重复申请，并入主申请
  | 'cancelled'      // 申请人撤回

export type GrantStatus =
  | 'active'         // 生效中
  | 'expired'        // 已到期
  | 'revoked'        // 已撤销
  | 'reconfirming'   // 待重新确认（字段/用途变化）
  | 'superseded'     // 被重新确认后的新授权取代

export interface UserProfile {
  id: string
  name: string
  dept: string
  title: string
}

export interface DataField {
  id: string
  datasetId: string
  name: string
  type: string
  sensitivity: Sensitivity
  description: string
  status: FieldStatus
  /** 变更说明：modified / deleted 时记录 */
  changeNote?: string
  /** 原字段 id：字段被“改名/改类型”时保留，用于追踪授权漂移 */
  previousFieldId?: string
  createdAt: string
  updatedAt: string
}

export interface Dataset {
  id: string
  name: string
  tableName: string
  domain: string
  ownerId: string
  description: string
  createdAt: string
  updatedAt: string
}

export interface Purpose {
  id: string
  name: string
  category: string
  description: string
  /** 允许使用的最高敏感级别 */
  maxSensitivity: Sensitivity
  active: boolean
  createdAt: string
}

export interface Consumer {
  id: string
  name: string
  kind: ConsumerKind
  ownerId: string
  system: string
  description: string
  createdAt: string
}

export interface ProcessRecord {
  id: string
  at: string
  byUserId: string
  action: string
  comment?: string
}

export interface ConsumptionApp {
  id: string
  no: string
  datasetId: string
  consumerId: string
  applicantId: string
  fieldIds: string[]
  purposeId: string
  reason: string
  /** 申请的授权有效期（天），空表示长期 */
  validityDays: number | null
  status: AppStatus
  createdAt: string
  /** 被哪条申请合并 */
  mergedIntoId?: string
  /** 重复申请分组 key（同数据集+消费方+字段集合+用途） */
  dedupeKey: string
  records: ProcessRecord[]
  /** 批准后生成的授权 id */
  grantId?: string
}

export interface Grant {
  id: string
  no: string
  datasetId: string
  consumerId: string
  fieldIds: string[]
  purposeId: string
  sourceAppId: string
  /** 版本链：前一版授权 */
  previousGrantId?: string
  status: GrantStatus
  approvedBy: string
  approvedAt: string
  expiresAt: string | null
  revokedAt?: string
  revokeReason?: string
  /** 待重新确认的原因 */
  reconfirmReason?: string
}

export interface AppState {
  users: UserProfile[]
  datasets: Dataset[]
  fields: DataField[]
  purposes: Purpose[]
  consumers: Consumer[]
  apps: ConsumptionApp[]
  grants: Grant[]
  seq: number
}

// ===================== 视图辅助类型 =====================

/** 授权的实时生效状态（派生，不持久化） */
export type EffectiveStatus = GrantStatus | 'invalid'

export interface ToastMsg {
  id: number
  kind: 'success' | 'error' | 'info'
  text: string
}
