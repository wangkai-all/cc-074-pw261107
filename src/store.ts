import { useSyncExternalStore } from 'react'
import type {
  AppState, AppStatus, ConsumptionApp, DataField, EffectiveStatus,
  Grant, GrantStatus, ProcessRecord, Sensitivity, ToastMsg,
} from './types'
import { buildSeed } from './seed'
import { SENS_ORDER, isExpired } from './utils/format'

const STORAGE_KEY = 'dcr-state-v3'
const SYSTEM_USER = 'u01'

interface PersistShape {
  appState: AppState
  currentUserId: string
}

// ---------------- 存储与订阅 ----------------
let state: AppState
let currentUserId: string
let toasts: ToastMsg[] = []
const listeners = new Set<() => void>()
let toastSeq = 1

function load(): { appState: AppState; currentUserId: string } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as PersistShape
      if (parsed?.appState?.datasets) return { appState: parsed.appState, currentUserId: parsed.currentUserId || 'u01' }
    }
  } catch {
    /* 损坏的本地缓存直接回退种子 */
  }
  return { appState: buildSeed(), currentUserId: 'u01' }
}

const initial = load()
state = initial.appState
currentUserId = initial.currentUserId

function persist() {
  const payload: PersistShape = { appState: state, currentUserId }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
}

function emit() {
  persist()
  listeners.forEach((l) => l())
}

function subscribe(l: () => void) {
  listeners.add(l)
  return () => listeners.delete(l)
}

export function getState(): AppState {
  return state
}
export function getCurrentUserId(): string {
  return currentUserId
}
export function getToasts(): ToastMsg[] {
  return toasts
}

export function useStore(): AppState {
  return useSyncExternalStore(subscribe, getState, getState)
}
export function useCurrentUserId(): string {
  return useSyncExternalStore(subscribe, getCurrentUserId, getCurrentUserId)
}
export function useToasts(): ToastMsg[] {
  return useSyncExternalStore(subscribe, getToasts, getToasts)
}

// ---------------- 通用工具 ----------------
const nowIso = () => new Date().toISOString()

function nextId(prefix: string): string {
  state = { ...state, seq: state.seq + 1 }
  return `${prefix}${state.seq}`
}

function nextNo(prefix: 'APP' | 'GR'): string {
  const ym = new Date().toISOString().slice(0, 7).replace('-', '')
  const nos = [...state.apps.map((a) => a.no), ...state.grants.map((g) => g.no)]
  const max = nos.reduce((m, no) => {
    const tail = Number(no.split('-')[2])
    return Number.isFinite(tail) ? Math.max(m, tail) : m
  }, 0)
  return `${prefix}-${ym}-${String(max + 1).padStart(3, '0')}`
}

function addRecord(appId: string, action: string, comment?: string, by = currentUserId) {
  const r: ProcessRecord = { id: nextId('PR'), at: nowIso(), byUserId: by, action, comment }
  state = {
    ...state,
    apps: state.apps.map((a) => (a.id === appId ? { ...a, records: [...a.records, r] } : a)),
  }
}

export function toast(kind: ToastMsg['kind'], text: string) {
  const t: ToastMsg = { id: ++toastSeq, kind, text }
  toasts = [...toasts, t]
  listeners.forEach((l) => l())
  setTimeout(() => {
    toasts = toasts.filter((x) => x.id !== t.id)
    listeners.forEach((l) => l())
  }, 4200)
}

export function dismissToast(id: number) {
  toasts = toasts.filter((t) => t.id !== id)
  listeners.forEach((l) => l())
}

export function setCurrentUser(uid: string) {
  currentUserId = uid
  emit()
}

export function resetAll() {
  state = buildSeed()
  currentUserId = 'u01'
  emit()
  toast('info', '已恢复为虚构目录示例数据')
}

// ---------------- 选择器（派生数据，不持久化） ----------------
export function fieldDatasetId(s: AppState, fid: string): string | undefined {
  return s.fields.find((f) => f.id === fid)?.datasetId
}

export const fieldsOf = (s: AppState, dsId: string) =>
  s.fields.filter((f) => f.datasetId === dsId)

export const grantsOfDataset = (s: AppState, dsId: string) => s.grants.filter((g) => g.datasetId === dsId)
export const appsOfDataset = (s: AppState, dsId: string) => s.apps.filter((a) => a.datasetId === dsId)

/** 授权的实时状态：到期是派生判定，到期授权不可继续使用、不可沿用 */
export function effectiveStatus(s: AppState, g: Grant): EffectiveStatus {
  if (g.status === 'reconfirming') return 'reconfirming'
  if (g.status === 'revoked' || g.status === 'superseded') return g.status
  if (isExpired(g.expiresAt)) return 'expired'
  return g.status
}

/** 正在使用该数据集的消费方（生效中或待重新确认；到期/撤销/取代不计） */
export function activeConsumersOfDataset(s: AppState, dsId: string) {
  const ids = new Set<string>()
  s.grants.forEach((g) => {
    if (g.datasetId !== dsId) return
    const st = effectiveStatus(s, g)
    if (st === 'active' || st === 'reconfirming') ids.add(g.consumerId)
  })
  return [...ids].map((cid) => s.consumers.find((c) => c.id === cid)!).filter(Boolean)
}

export function grantsOfConsumer(s: AppState, consumerId: string) {
  return s.grants.filter((g) => g.consumerId === consumerId)
}

/** 当前用户待审批：按数据集负责人派生，负责人变更即自动转交 */
export function pendingAppsForUser(s: AppState, userId: string): ConsumptionApp[] {
  return s.apps.filter((a) => {
    if (a.status !== 'pending') return false
    const ds = s.datasets.find((d) => d.id === a.datasetId)
    return ds?.ownerId === userId
  })
}

/** 重复申请分组（同数据集+消费方+字段集合+用途，出现多次） */
export function duplicateGroups(s: AppState): { key: string; apps: ConsumptionApp[] }[] {
  const map = new Map<string, ConsumptionApp[]>()
  s.apps.forEach((a) => {
    const arr = map.get(a.dedupeKey) || []
    arr.push(a)
    map.set(a.dedupeKey, arr)
  })
  return [...map.entries()]
    .filter(([, arr]) => arr.length > 1)
    .map(([key, apps]) => ({ key, apps: [...apps].sort((a, b) => a.createdAt.localeCompare(b.createdAt)) }))
}

export function dedupeKeyOf(dsId: string, consumerId: string, fieldIds: string[], purposeId: string) {
  return [dsId, consumerId, [...fieldIds].sort().join('+'), purposeId].join('|')
}

/** 找出会被字段/用途变更影响的生效授权 */
export function impactedGrants(s: AppState, dsId: string, fieldIds: string[], purposeId?: string): Grant[] {
  const fset = new Set(fieldIds)
  return s.grants.filter((g) => {
    if (g.datasetId !== dsId) return false
    if (purposeId && g.purposeId !== purposeId) return false
    if (!['active', 'reconfirming'].includes(g.status)) return false
    if (isExpired(g.expiresAt)) return false
    if (purposeId) return true
    return g.fieldIds.some((fid) => fset.has(fid))
  })
}

// ---------------- 数据集 / 字段维护 ----------------
export function addDataset(input: { name: string; tableName: string; domain: string; ownerId: string; description: string }) {
  const id = nextId('ds')
  state = {
    ...state,
    datasets: [
      ...state.datasets,
      { id, ...input, createdAt: nowIso(), updatedAt: nowIso() },
    ],
  }
  emit()
  toast('success', `数据集「${input.name}」已登记`)
  return id
}

export function changeDatasetOwner(dsId: string, newOwnerId: string) {
  const ds = state.datasets.find((d) => d.id === dsId)
  const u = state.users.find((x) => x.id === newOwnerId)
  if (!ds || !u) return
  state = {
    ...state,
    datasets: state.datasets.map((d) => (d.id === dsId ? { ...d, ownerId: newOwnerId, updatedAt: nowIso() } : d)),
  }
  // 待审批事项转交：在每条待审批申请上留痕
  state.apps
    .filter((a) => a.datasetId === dsId && a.status === 'pending')
    .forEach((a) => addRecord(a.id, '负责人变更转交', `数据集负责人变更为 ${u.name}，待审批事项自动转交`))
  emit()
  toast('success', `负责人已变更为 ${u.name}，待审批事项已自动转交`)
}

export function addField(dsId: string, input: Omit<DataField, 'id' | 'datasetId' | 'status' | 'createdAt' | 'updatedAt'>) {
  const id = nextId('f')
  const ts = nowIso()
  state = {
    ...state,
    fields: [...state.fields, { ...input, id, datasetId: dsId, status: 'active', createdAt: ts, updatedAt: ts }],
    datasets: state.datasets.map((d) => (d.id === dsId ? { ...d, updatedAt: ts } : d)),
  }
  emit()
  toast('success', `字段 ${input.name} 已添加`)
}

/**
 * 字段结构性修改（改名/类型/敏感级别）：
 * 标记 modified，并把引用该字段的生效授权全部置为待重新确认。
 * 仅改描述不触发授权复核。
 */
export function updateField(fieldId: string, patch: Partial<Pick<DataField, 'name' | 'type' | 'sensitivity' | 'description' | 'changeNote'>>) {
  const f = state.fields.find((x) => x.id === fieldId)
  if (!f) return
  const structural =
    (patch.name !== undefined && patch.name !== f.name) ||
    (patch.type !== undefined && patch.type !== f.type) ||
    (patch.sensitivity !== undefined && patch.sensitivity !== f.sensitivity)

  const note = patch.changeNote || (structural ? '字段定义发生变更，需下游重新确认' : undefined)
  state = {
    ...state,
    fields: state.fields.map((x) =>
      x.id === fieldId
        ? { ...x, ...patch, status: structural ? 'modified' : x.status, changeNote: structural ? note : x.changeNote, updatedAt: nowIso() }
        : x,
    ),
  }

  if (structural) {
    const dsId = fieldDatasetId(state, fieldId)!
    const hits = impactedGrants(state, dsId, [fieldId])
    suspendGrants(hits, `字段 ${f.name} 定义变更（${note}）`)
    toast(hits.length ? 'info' : 'success', `字段已修改${hits.length ? `，${hits.length} 条授权需重新确认` : ''}`)
  } else {
    toast('success', '字段描述已更新')
  }
  emit()
}

/** 删除字段：软删除并触发引用方重新确认，授权不会因表名没变而沿用 */
export function deleteField(fieldId: string) {
  const f = state.fields.find((x) => x.id === fieldId)
  if (!f) return
  const dsId = fieldDatasetId(state, fieldId)!
  state = {
    ...state,
    fields: state.fields.map((x) =>
      x.id === fieldId ? { ...x, status: 'deleted', changeNote: '字段已删除，停止下游使用', updatedAt: nowIso() } : x,
    ),
  }
  const hits = impactedGrants(state, dsId, [fieldId])
  suspendGrants(hits, `字段 ${f.name} 已删除，授权范围需重新确认`)
  emit()
  toast(hits.length ? 'info' : 'success', `字段 ${f.name} 已删除${hits.length ? `，${hits.length} 条授权待重新确认` : ''}`)
}

function suspendGrants(grants: Grant[], reason: string) {
  if (!grants.length) return
  const ids = new Set(grants.map((g) => g.id))
  state = {
    ...state,
    grants: state.grants.map((g) =>
      ids.has(g.id) && g.status !== 'reconfirming'
        ? { ...g, status: 'reconfirming' as GrantStatus, reconfirmReason: reason }
        : ids.has(g.id)
          ? { ...g, reconfirmReason: reason }
          : g,
    ),
  }
  grants.forEach((g) => addRecord(g.sourceAppId, '授权待重新确认', reason))
}

// ---------------- 用途目录变化 ----------------
export function setPurposeMaxSensitivity(purposeId: string, level: Sensitivity) {
  const p = state.purposes.find((x) => x.id === purposeId)
  if (!p) return
  state = { ...state, purposes: state.purposes.map((x) => (x.id === purposeId ? { ...x, maxSensitivity: level } : x)) }
  const hits = state.grants.filter((g) => {
    if (g.purposeId !== purposeId || !['active', 'reconfirming'].includes(g.status) || isExpired(g.expiresAt)) return false
    return g.fieldIds.some((fid) => {
      const f = state.fields.find((x) => x.id === fid)
      return f && SENS_ORDER[f.sensitivity] > SENS_ORDER[level]
    })
  })
  suspendGrants(hits, `用途「${p.name}」最高敏感级别调整为 ${level}，超出新上限的授权需重新确认`)
  emit()
  toast(hits.length ? 'info' : 'success', `用途级别已调整${hits.length ? `，${hits.length} 条授权待重新确认` : ''}`)
}

export function togglePurposeActive(purposeId: string) {
  const p = state.purposes.find((x) => x.id === purposeId)
  if (!p) return
  const next = !p.active
  state = { ...state, purposes: state.purposes.map((x) => (x.id === purposeId ? { ...x, active: next } : x)) }
  if (!next) {
    const hits = state.grants.filter(
      (g) => g.purposeId === purposeId && ['active', 'reconfirming'].includes(g.status) && !isExpired(g.expiresAt),
    )
    suspendGrants(hits, `用途「${p.name}」已停用，相关授权需重新确认`)
    toast(hits.length ? 'info' : 'success', `用途已停用${hits.length ? `，${hits.length} 条授权待重新确认` : ''}`)
  } else {
    toast('success', `用途「${p.name}」已重新启用`)
  }
  emit()
}

// ---------------- 消费申请 ----------------
export interface SubmitAppInput {
  datasetId: string
  consumerId: string
  applicantId: string
  fieldIds: string[]
  purposeId: string
  reason: string
  validityDays: number | null
}

export function submitApp(input: SubmitAppInput): { ok: boolean; error?: string; appId?: string } {
  if (!input.fieldIds.length) return { ok: false, error: '请至少选择一个字段' }
  if (!input.reason.trim()) return { ok: false, error: '请填写使用目的说明' }
  const purpose = state.purposes.find((p) => p.id === input.purposeId)
  if (!purpose) return { ok: false, error: '用途不存在' }
  if (!purpose.active) return { ok: false, error: `用途「${purpose.name}」已停用，不能按此用途提交申请` }

  // 敏感级别校验：字段级别不得超过用途上限
  const picked = input.fieldIds.map((fid) => state.fields.find((f) => f.id === fid)!)
  const over = picked.filter((f) => SENS_ORDER[f.sensitivity] > SENS_ORDER[purpose.maxSensitivity])
  if (over.length) {
    return { ok: false, error: `字段 ${over.map((f) => f.name).join('、')} 的敏感级别超出用途「${purpose.name}」的上限 ${purpose.maxSensitivity}` }
  }
  const deleted = picked.filter((f) => f.status === 'deleted')
  if (deleted.length) return { ok: false, error: `字段 ${deleted.map((f) => f.name).join('、')} 已删除，不能申请` }

  const key = dedupeKeyOf(input.datasetId, input.consumerId, input.fieldIds, input.purposeId)
  // 仅并入仍在处理中、或其授权仍然生效/待确认的历史申请；已到期/撤销的旧单不再合并
  const primary = state.apps.find((a) => {
    if (a.dedupeKey !== key) return false
    if (a.status === 'pending') return true
    if (a.status !== 'approved' || !a.grantId) return false
    const g = state.grants.find((x) => x.id === a.grantId)
    if (!g) return false
    const st = effectiveStatus(state, g)
    return st === 'active' || st === 'reconfirming'
  })

  const id = nextId('a')
  const no = nextNo('APP')
  const base: ConsumptionApp = {
    id, no, datasetId: input.datasetId, consumerId: input.consumerId, applicantId: input.applicantId,
    fieldIds: [...input.fieldIds], purposeId: input.purposeId, reason: input.reason.trim(),
    validityDays: input.validityDays, status: 'pending', createdAt: nowIso(), dedupeKey: key,
    records: [{ id: nextId('PR'), at: nowIso(), byUserId: input.applicantId, action: '提交申请' }],
  }

  if (primary) {
    // 重复申请：合并显示，但两条申请各自保留处理记录
    const dup: ConsumptionApp = { ...base, status: 'duplicate' as AppStatus, mergedIntoId: primary.id }
    dup.records.push({ id: nextId('PR'), at: nowIso(), byUserId: currentUserId, action: '合并重复申请', comment: `与 ${primary.no} 字段集合、用途完全相同，并入主单处理` })
    state = { ...state, apps: [...state.apps, dup] }
    addRecord(primary.id, '收到重复申请', `${no} 与本单内容相同，已合并至本单统一处理`)
    emit()
    toast('info', `检测到重复申请，已合并到主单 ${primary.no}（各自保留处理记录）`)
    return { ok: true, appId: primary.id }
  }

  state = { ...state, apps: [...state.apps, base] }
  emit()
  toast('success', `申请 ${no} 已提交，等待数据集负责人审批`)
  return { ok: true, appId: id }
}

export function approveApp(appId: string, comment?: string): { ok: boolean; error?: string } {
  const app = state.apps.find((a) => a.id === appId)
  if (!app || app.status !== 'pending') return { ok: false, error: '该申请不在待审批状态' }
  const purpose = state.purposes.find((p) => p.id === app.purposeId)!
  if (!purpose.active) return { ok: false, error: `用途「${purpose.name}」已停用，请先调整申请用途` }
  const picked = app.fieldIds.map((fid) => state.fields.find((f) => f.id === fid)!)
  const over = picked.filter((f) => SENS_ORDER[f.sensitivity] > SENS_ORDER[purpose.maxSensitivity])
  if (over.length) return { ok: false, error: `字段 ${over.map((f) => f.name).join('、')} 超出用途敏感级别上限，不能批准` }
  if (picked.some((f) => f.status === 'deleted')) return { ok: false, error: '申请包含已删除字段，请退回修改后再批准' }

  const grantId = nextId('g')
  const grant: Grant = {
    id: grantId, no: nextNo('GR'), datasetId: app.datasetId, consumerId: app.consumerId,
    fieldIds: [...app.fieldIds], purposeId: app.purposeId, sourceAppId: app.id, status: 'active',
    approvedBy: currentUserId, approvedAt: nowIso(),
    expiresAt: app.validityDays ? new Date(Date.now() + app.validityDays * 86400000).toISOString() : null,
  }
  state = {
    ...state,
    grants: [...state.grants, grant],
    apps: state.apps.map((a) => (a.id === appId ? { ...a, status: 'approved' as AppStatus, grantId } : a)),
  }
  addRecord(appId, '批准', comment || `生成授权记录 ${grant.no}`)
  emit()
  toast('success', `已批准并生成可追踪授权 ${grant.no}`)
  return { ok: true }
}

export function rejectApp(appId: string, comment: string) {
  const app = state.apps.find((a) => a.id === appId)
  if (!app || app.status !== 'pending') return toast('error', '该申请不在待审批状态')
  state = { ...state, apps: state.apps.map((a) => (a.id === appId ? { ...a, status: 'rejected' as AppStatus } : a)) }
  addRecord(appId, '驳回', comment)
  emit()
  toast('success', '申请已驳回并记录原因')
}

export function cancelApp(appId: string) {
  const app = state.apps.find((a) => a.id === appId)
  if (!app || app.status !== 'pending') return
  state = { ...state, apps: state.apps.map((a) => (a.id === appId ? { ...a, status: 'cancelled' as AppStatus } : a)) }
  addRecord(appId, '申请人撤回')
  emit()
  toast('success', '申请已撤回')
}

/** 撤销授权：授权与来源申请同步置为撤销态，全程留痕 */
export function revokeGrant(grantId: string, reason: string) {
  const g = state.grants.find((x) => x.id === grantId)
  if (!g || ['revoked', 'superseded'].includes(g.status)) return toast('error', '该授权已不可撤销')
  state = {
    ...state,
    grants: state.grants.map((x) =>
      x.id === grantId ? { ...x, status: 'revoked' as GrantStatus, revokedAt: nowIso(), revokeReason: reason } : x,
    ),
    apps: state.apps.map((a) => (a.id === g.sourceAppId ? { ...a, status: 'revoked' as AppStatus } : a)),
  }
  addRecord(g.sourceAppId, '撤销授权', reason)
  emit()
  toast('success', `授权 ${g.no} 已撤销`)
}

/**
 * 重新确认：通过则旧授权 superseded、生成新版本授权（版本链可追踪）；
 * 拒绝则按撤销处理。字段清单可在确认时调整（删除字段默认剔除）。
 */
export function reconfirmGrant(grantId: string, approve: boolean, fieldIds: string[], comment: string) {
  const g = state.grants.find((x) => x.id === grantId)
  if (!g || g.status !== 'reconfirming') return toast('error', '该授权不在待重新确认状态')
  if (approve && !fieldIds.length) return toast('error', '确认通过至少保留一个字段')

  if (!approve) {
    state = {
      ...state,
      grants: state.grants.map((x) =>
        x.id === grantId
          ? { ...x, status: 'revoked' as GrantStatus, revokedAt: nowIso(), revokeReason: `重新确认拒绝：${comment}` }
          : x,
      ),
      apps: state.apps.map((a) => (a.id === g.sourceAppId ? { ...a, status: 'revoked' as AppStatus } : a)),
    }
    addRecord(g.sourceAppId, '重新确认拒绝', comment)
    emit()
    return toast('success', '已拒绝新口径，授权按撤销处理')
  }

  const newId = nextId('g')
  const today = Date.now()
  const expiresAt =
    g.expiresAt == null
      ? null
      : new Date(g.expiresAt).getTime() > today
        ? g.expiresAt
        : new Date(today + 90 * 86400000).toISOString()
  const newGrant: Grant = {
    ...g, id: newId, no: nextNo('GR'), fieldIds: [...fieldIds], status: 'active',
    previousGrantId: g.id, reconfirmReason: undefined, approvedBy: currentUserId, approvedAt: nowIso(),
    expiresAt, revokedAt: undefined, revokeReason: undefined,
  }
  state = {
    ...state,
    grants: [
      ...state.grants.map((x) => (x.id === grantId ? { ...x, status: 'superseded' as GrantStatus } : x)),
      newGrant,
    ],
    apps: state.apps.map((a) => (a.id === g.sourceAppId ? { ...a, grantId: newId, status: 'approved' as AppStatus } : a)),
  }
  addRecord(g.sourceAppId, '重新确认通过', `${comment || '接受变更后的字段口径'}，生成新版本授权 ${newGrant.no}`)
  emit()
  toast('success', `重新确认通过，新授权 ${newGrant.no} 已生效（旧版本保留可追溯）`)
}

/** 到期授权不能沿用：基于历史授权重新提交一条新申请 */
export function reapplyFromGrant(grantId: string) {
  const g = state.grants.find((x) => x.id === grantId)
  if (!g) return
  const app = state.apps.find((a) => a.id === g.sourceAppId)
  const fieldIds = g.fieldIds.filter((fid) => state.fields.find((f) => f.id === fid)?.status !== 'deleted')
  const res = submitApp({
    datasetId: g.datasetId, consumerId: g.consumerId,
    applicantId: app?.applicantId || currentUserId,
    fieldIds, purposeId: g.purposeId,
    reason: `原授权 ${g.no} 已到期，申请延续使用（原用途与字段范围）`,
    validityDays: 180,
  })
  if (res.ok && res.appId) addRecord(g.sourceAppId, '到期重新申请', '旧授权已到期，不可沿用，已基于原范围提交新申请')
  emit()
}

// ---------------- 消费方目录 ----------------
export function addConsumer(input: { name: string; kind: 'report' | 'task'; ownerId: string; system: string; description: string }) {
  const id = nextId('c')
  state = { ...state, consumers: [...state.consumers, { id, ...input, createdAt: nowIso() }] }
  emit()
  toast('success', `消费方「${input.name}」已登记`)
}
