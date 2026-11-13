import { useMemo, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import type { AppState, ConsumptionApp, Grant } from '../types'
import { SENS_META, SENS_ORDER, fmtDateTime } from '../utils/format'
import {
  reconfirmGrant, rejectApp, approveApp, submitApp, useCurrentUserId, useStore,
} from '../store'
import { Badge, Modal } from './ui'
import { FIELD_STATUS_LABEL, sensBadge } from '../labels'

// ---------------- 处理记录时间线 ----------------
export function Timeline({ app }: { app: ConsumptionApp }) {
  const s = useStore()
  const userName = (id: string) => s.users.find((u) => u.id === id)?.name || id
  const toneOf = (action: string) => {
    if (action.includes('驳回') || action.includes('拒绝') || action.includes('撤销')) return 'danger'
    if (action.includes('批准') || action.includes('通过')) return 'ok'
    if (action.includes('重新确认') || action.includes('转交') || action.includes('重复') || action.includes('到期')) return 'warn'
    return ''
  }
  return (
    <div className="timeline">
      {app.records.map((r) => (
        <div key={r.id} className={`tl-item ${toneOf(r.action)}`}>
          <div className="tl-head">
            <span className="tl-action">{r.action}</span>
            <span className="muted small">{userName(r.byUserId)}</span>
            <span className="muted small" style={{ marginLeft: 'auto' }}>{fmtDateTime(r.at)}</span>
          </div>
          {r.comment && <div className="small" style={{ color: 'var(--text-2)', marginTop: 3 }}>{r.comment}</div>}
        </div>
      ))}
    </div>
  )
}

// ---------------- 新消费申请 ----------------
export function NewAppModal({ s, defaultDatasetId, onClose }: { s: AppState; defaultDatasetId?: string; onClose: () => void }) {
  const uid = useCurrentUserId()
  const [datasetId, setDatasetId] = useState(defaultDatasetId || s.datasets[0].id)
  const [consumerId, setConsumerId] = useState(s.consumers[0].id)
  const [purposeId, setPurposeId] = useState(s.purposes[0].id)
  const [fieldIds, setFieldIds] = useState<string[]>([])
  const [reason, setReason] = useState('')
  const [validity, setValidity] = useState<string>('180')
  const [error, setError] = useState('')

  const dsFields = useMemo(
    () => s.fields.filter((f) => f.datasetId === datasetId),
    [s.fields, datasetId],
  )
  const purpose = s.purposes.find((p) => p.id === purposeId)!

  const toggleField = (id: string) =>
    setFieldIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

  const overLimit = fieldIds
    .map((id) => s.fields.find((f) => f.id === id)!)
    .filter((f) => SENS_ORDER[f.sensitivity] > SENS_ORDER[purpose.maxSensitivity])

  const submit = () => {
    const res = submitApp({
      datasetId, consumerId, applicantId: uid, fieldIds, purposeId, reason,
      validityDays: validity === 'long' ? null : Number(validity),
    })
    if (!res.ok) { setError(res.error || '提交失败'); return }
    onClose()
  }

  return (
    <Modal
      wide
      title="新消费申请"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>取消</button>
          <button className="btn primary" onClick={submit}>提交申请</button>
        </>
      }
    >
      <div className="form-grid-2">
        <div className="field">
          <label>数据集</label>
          <select className="input" value={datasetId} onChange={(e) => { setDatasetId(e.target.value); setFieldIds([]) }}>
            {s.datasets.map((d) => <option key={d.id} value={d.id}>{d.name}（{d.tableName}）</option>)}
          </select>
        </div>
        <div className="field">
          <label>消费方（报表 / 任务）</label>
          <select className="input" value={consumerId} onChange={(e) => setConsumerId(e.target.value)}>
            {s.consumers.map((c) => <option key={c.id} value={c.id}>{c.kind === 'report' ? '报表' : '任务'} · {c.name}</option>)}
          </select>
        </div>
      </div>

      <div className="form-grid-2">
        <div className="field">
          <label>下游用途 <span className="hint">（仅可选择已批准用途目录中的用途）</span></label>
          <select className="input" value={purposeId} onChange={(e) => setPurposeId(e.target.value)}>
            {s.purposes.filter((p) => p.active).map((p) => (
              <option key={p.id} value={p.id}>{p.category} / {p.name}（上限 {p.maxSensitivity}）</option>
            ))}
          </select>
          <div className="hint small" style={{ marginTop: 5 }}>{purpose.description}</div>
        </div>
        <div className="field">
          <label>授权有效期</label>
          <select className="input" value={validity} onChange={(e) => setValidity(e.target.value)}>
            <option value="30">30 天</option>
            <option value="90">90 天</option>
            <option value="180">180 天</option>
            <option value="365">1 年</option>
            <option value="long">长期有效（仍受字段/用途变更约束）</option>
          </select>
        </div>
      </div>

      <div className="field">
        <label>选择具体字段 <span className="hint">（敏感级别不得超过用途上限 {purpose.maxSensitivity}）</span></label>
        <div className="check-list">
          {dsFields.map((f) => {
            const over = SENS_ORDER[f.sensitivity] > SENS_ORDER[purpose.maxSensitivity]
            return (
              <label key={f.id} className="check-item">
                <input type="checkbox" checked={fieldIds.includes(f.id)} disabled={f.status === 'deleted'} onChange={() => toggleField(f.id)} />
                <div>
                  <b className="mono">{f.name}</b>
                  <span className="muted small" style={{ marginLeft: 8 }}>{f.type}</span>
                  <div className="muted small">{f.description}</div>
                </div>
                <div className="meta">
                  <Badge {...sensBadge(f.sensitivity)} />
                  {f.status !== 'active' && <Badge text={FIELD_STATUS_LABEL[f.status].text} tone={FIELD_STATUS_LABEL[f.status].tone} />}
                  {over && <Badge text="超用途上限" tone="red" />}
                </div>
              </label>
            )
          })}
        </div>
        {overLimit.length > 0 && (
          <div className="callout warn" style={{ marginTop: 10 }}>
            <AlertTriangle size={15} />
            <div>字段 {overLimit.map((f) => f.name).join('、')} 超出「{purpose.name}」允许的最高敏感级别 {purpose.maxSensitivity}，请移除或更换用途。</div>
          </div>
        )}
      </div>

      <div className="field">
        <label>使用目的说明</label>
        <textarea className="input" placeholder="说明业务场景、取数方式与数据去向…" value={reason} onChange={(e) => setReason(e.target.value)} />
      </div>
      {error && <div className="error-text">{error}</div>}
    </Modal>
  )
}

// ---------------- 审批弹窗 ----------------
export function ApproveModal({ app, onClose }: { app: ConsumptionApp; onClose: () => void }) {
  const [comment, setComment] = useState('')
  const [error, setError] = useState('')
  return (
    <Modal
      title={`审批 ${app.no}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>取消</button>
          <button className="btn danger" onClick={() => {
            if (!comment.trim()) { setError('驳回必须填写原因'); return }
            rejectApp(app.id, comment.trim()); onClose()
          }}>驳回</button>
          <button className="btn primary" onClick={() => {
            const r = approveApp(app.id, comment.trim() || undefined)
            if (!r.ok) { setError(r.error || '审批失败'); return }
            onClose()
          }}>批准并生成授权</button>
        </>
      }
    >
      <ApprovalBody app={app} comment={comment} setComment={setComment} error={error} />
    </Modal>
  )
}

export function ApprovalBody({ app, comment, setComment, error }: {
  app: ConsumptionApp; comment: string; setComment: (v: string) => void; error?: string
}) {
  const s = useStore()
  const ds = s.datasets.find((d) => d.id === app.datasetId)!
  const c = s.consumers.find((x) => x.id === app.consumerId)!
  const p = s.purposes.find((x) => x.id === app.purposeId)!
  return (
    <>
      <dl className="kv">
        <dt>数据集</dt><dd>{ds.name} <span className="mono muted small">{ds.tableName}</span></dd>
        <dt>消费方</dt><dd>{c.kind === 'report' ? '报表' : '任务'} · {c.name}</dd>
        <dt>用途</dt><dd>{p.name}（敏感级别上限 {p.maxSensitivity}）</dd>
        <dt>有效期</dt><dd>{app.validityDays ? `${app.validityDays} 天` : '长期有效'}</dd>
        <dt>申请说明</dt><dd>{app.reason}</dd>
      </dl>
      <div className="section-title" style={{ marginTop: 14 }}>申请字段</div>
      <div className="table-wrap">
        <table className="data">
          <thead><tr><th>字段</th><th>类型</th><th>敏感级别</th><th>状态</th></tr></thead>
          <tbody>
            {app.fieldIds.map((fid) => {
              const f = s.fields.find((x) => x.id === fid)
              if (!f) return <tr key={fid}><td colSpan={4} className="muted">字段 {fid} 已不存在</td></tr>
              const over = SENS_ORDER[f.sensitivity] > SENS_ORDER[p.maxSensitivity]
              return (
                <tr key={fid} className={over || f.status !== 'active' ? 'row-danger' : ''}>
                  <td className="mono">{f.name}</td><td className="mono small muted">{f.type}</td>
                  <td><Badge {...sensBadge(f.sensitivity)} /></td>
                  <td>
                    <Badge text={FIELD_STATUS_LABEL[f.status].text} tone={FIELD_STATUS_LABEL[f.status].tone} />
                    {over && <span style={{ marginLeft: 8 }}><Badge text="超用途上限" tone="red" /></span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="field" style={{ marginTop: 14 }}>
        <label>审批意见</label>
        <textarea className="input" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="批准意见或驳回原因（驳回必填）" />
      </div>
      {error && <div className="error-text">{error}</div>}
    </>
  )
}

// ---------------- 重新确认弹窗 ----------------
export function ReconfirmModal({ grant, onClose }: { grant: Grant; onClose: () => void }) {
  const s = useStore()
  const [fieldIds, setFieldIds] = useState<string[]>(grant.fieldIds.filter((fid) => s.fields.find((f) => f.id === fid)?.status !== 'deleted'))
  const [comment, setComment] = useState('')
  const [error, setError] = useState('')

  return (
    <Modal
      wide
      title={`重新确认授权 ${grant.no}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>取消</button>
          <button className="btn danger" onClick={() => {
            if (!comment.trim()) { setError('拒绝确认需要填写原因'); return }
            reconfirmGrant(grant.id, false, fieldIds, comment.trim()); onClose()
          }}>拒绝并撤销</button>
          <button className="btn primary" onClick={() => {
            reconfirmGrant(grant.id, true, fieldIds, comment.trim()); onClose()
          }}>确认通过，生成新版本授权</button>
        </>
      }
    >
      <div className="callout warn">
        <AlertTriangle size={15} />
        <div>
          <b>触发原因：</b>{grant.reconfirmReason}
          <div className="small" style={{ marginTop: 4 }}>
            授权不会因表名未变而沿用。确认通过后旧授权标记为「已被新版本取代」并生成新版本授权，版本链完整保留。
          </div>
        </div>
      </div>
      <div className="section-title" style={{ marginTop: 14 }}>核对字段范围（已删除字段默认剔除，可手动调整）</div>
      <div className="check-list">
        {grant.fieldIds.map((fid) => {
          const f = s.fields.find((x) => x.id === fid)
          if (!f) return null
          const removed = f.status === 'deleted'
          return (
            <label key={fid} className="check-item">
              <input type="checkbox" checked={!removed && fieldIds.includes(fid)} disabled={removed}
                onChange={() => setFieldIds((prev) => prev.includes(fid) ? prev.filter((x) => x !== fid) : [...prev, fid])} />
              <div>
                <b className="mono">{f.name}</b>
                {f.changeNote && <div className="small" style={{ color: 'var(--amber)' }}>{f.changeNote}</div>}
              </div>
              <div className="meta">
                <Badge {...sensBadge(f.sensitivity)} />
                {f.status !== 'active' && <Badge text={FIELD_STATUS_LABEL[f.status].text} tone={FIELD_STATUS_LABEL[f.status].tone} />}
              </div>
            </label>
          )
        })}
      </div>
      <div className="field" style={{ marginTop: 14 }}>
        <label>确认说明</label>
        <textarea className="input" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="例如：已知悉成本价口径变更，报表逻辑已同步调整" />
      </div>
      {error && <div className="error-text">{error}</div>}
    </Modal>
  )
}
