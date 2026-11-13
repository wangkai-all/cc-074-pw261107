import type { AppState, Grant } from '../types'
import { csvCell, downloadText, fmtDate, fmtDateTime } from './format'
import { effectiveStatus } from '../store'

const STATUS_LABEL: Record<string, string> = {
  active: '生效中', expired: '已到期', revoked: '已撤销',
  reconfirming: '待重新确认', superseded: '已被新版本取代', invalid: '失效',
}

function rows(s: AppState, grants: Grant[]): string[] {
  const userName = (id: string) => s.users.find((u) => u.id === id)?.name || id
  return grants.map((g) => {
    const ds = s.datasets.find((d) => d.id === g.datasetId)
    const c = s.consumers.find((x) => x.id === g.consumerId)
    const p = s.purposes.find((x) => x.id === g.purposeId)
    const app = s.apps.find((a) => a.id === g.sourceAppId)
    const fieldNames = g.fieldIds
      .map((fid) => s.fields.find((f) => f.id === fid))
      .map((f) => (f ? `${f.name}[${f.sensitivity}${f.status === 'deleted' ? '/已删' : f.status === 'modified' ? '/已变更' : ''}]` : '(已移除字段)'))
      .join('；')
    return [
      g.no, ds?.name, ds?.tableName, c?.name, c?.kind === 'report' ? '报表' : '任务',
      fieldNames, p?.name, STATUS_LABEL[effectiveStatus(s, g)] || g.status,
      userName(g.approvedBy), fmtDate(g.approvedAt), fmtDate(g.expiresAt),
      g.reconfirmReason || g.revokeReason || '', app?.no || '',
    ].map(csvCell).join(',')
  })
}

const HEADER = [
  '授权编号', '数据集', '物理表名', '消费方', '消费方类型', '授权字段',
  '下游用途', '当前状态', '批准人', '批准时间', '到期时间', '备注', '来源申请',
]

export function exportConsumptionList(s: AppState, datasetId?: string) {
  const grants = datasetId ? s.grants.filter((g) => g.datasetId === datasetId) : s.grants
  const ds = datasetId ? s.datasets.find((d) => d.id === datasetId) : undefined
  const lines = [HEADER.join(','), ...rows(s, grants)]
  const stamp = new Date().toISOString().slice(0, 10)
  downloadText(`消费清单_${ds ? ds.name : '全部数据集'}_${stamp}.csv`, lines.join('\n'))
}

export function exportAppTimeline(s: AppState, appId: string) {
  const app = s.apps.find((a) => a.id === appId)
  if (!app) return
  const ds = s.datasets.find((d) => d.id === app.datasetId)
  const userName = (id: string) => s.users.find((u) => u.id === id)?.name || id
  const lines: string[] = []
  lines.push(['申请编号', '数据集', '消费方', '提交人', '当前状态'].join(','))
  const c = s.consumers.find((x) => x.id === app.consumerId)
  lines.push([app.no, ds?.name, c?.name, userName(app.applicantId), app.status].map(csvCell).join(','))
  lines.push('')
  lines.push(['时间', '操作人', '动作', '备注'].join(','))
  app.records.forEach((r) => lines.push([fmtDateTime(r.at), userName(r.byUserId), r.action, r.comment || ''].map(csvCell).join(',')))
  downloadText(`申请处理记录_${app.no}.csv`, lines.join('\n'))
}
