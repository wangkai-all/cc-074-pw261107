import { useMemo, useState } from 'react'
import { Download, GitCommitHorizontal, History, Ban, RotateCcw, RefreshCw } from 'lucide-react'
import type { EffectiveStatus } from '../types'
import {
  effectiveStatus, reapplyFromGrant, revokeGrant, useStore,
} from '../store'
import { Badge, Empty, Modal, PageHeader } from './ui'
import { ReconfirmModal, Timeline } from './forms'
import { grantStatusLabel, sensBadge } from '../labels'
import { daysUntil, fmtDate, fmtDateTime } from '../utils/format'
import { exportConsumptionList } from '../utils/export'

type Filter = 'all' | EffectiveStatus

const FILTERS: { key: Filter; text: string }[] = [
  { key: 'all', text: '全部' },
  { key: 'active', text: '生效中' },
  { key: 'reconfirming', text: '待重新确认' },
  { key: 'expired', text: '已到期' },
  { key: 'revoked', text: '已撤销' },
  { key: 'superseded', text: '版本历史' },
]

export function GrantsPage() {
  const s = useStore()
  const [filter, setFilter] = useState<Filter>('all')
  const [revokeId, setRevokeId] = useState<string | null>(null)
  const [reconfirmId, setReconfirmId] = useState<string | null>(null)
  const [timelineSourceApp, setTimelineSourceApp] = useState<string | null>(null)

  const rows = useMemo(() => {
    const all = [...s.grants].sort((a, b) => b.approvedAt.localeCompare(a.approvedAt))
    return filter === 'all' ? all : all.filter((g) => effectiveStatus(s, g) === filter)
  }, [s.grants, s, filter])

  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    s.grants.forEach((g) => { const st = effectiveStatus(s, g); c[st] = (c[st] || 0) + 1 })
    return c
  }, [s])

  const revokeGrantObj = revokeId ? s.grants.find((g) => g.id === revokeId) : null
  const reconfirmObj = reconfirmId ? s.grants.find((g) => g.id === reconfirmId) : null
  const timelineApp = timelineSourceApp ? s.apps.find((a) => a.id === timelineSourceApp) : null

  return (
    <>
      <PageHeader
        title="授权台账"
        desc="每条授权都可追踪到来源申请、字段范围、用途与版本链。到期授权自动失效且不可沿用；字段或用途变化触发的待重新确认在此集中处理。"
        actions={<button className="btn primary" onClick={() => exportConsumptionList(s)}><Download size={15} />导出全部消费清单</button>}
      />

      <div className="stat-grid">
        <div className="stat"><div className="num">{counts.active || 0}</div><div className="lbl">生效中授权</div></div>
        <div className="stat"><div className="num warn">{counts.reconfirming || 0}</div><div className="lbl">待重新确认（变更触发）</div></div>
        <div className="stat"><div className="num danger">{counts.expired || 0}</div><div className="lbl">已到期（不可沿用）</div></div>
        <div className="stat"><div className="num">{s.grants.length}</div><div className="lbl">授权记录总数（含历史版本）</div></div>
      </div>

      <div className="filter-bar">
        {FILTERS.map((f) => (
          <button key={f.key} className={`btn sm${filter === f.key ? ' primary' : ''}`} onClick={() => setFilter(f.key)}>
            {f.text}{f.key !== 'all' && counts[f.key] ? ` · ${counts[f.key]}` : ''}
          </button>
        ))}
      </div>

      <div className="card">
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr><th>授权编号 / 版本链</th><th>数据集</th><th>消费方</th><th>字段范围</th><th>用途</th><th>状态</th><th>有效期</th><th>操作</th></tr>
            </thead>
            <tbody>
              {rows.map((g) => {
                const st = effectiveStatus(s, g)
                const lab = grantStatusLabel(st)
                const ds = s.datasets.find((d) => d.id === g.datasetId)!
                const c = s.consumers.find((x) => x.id === g.consumerId)!
                const p = s.purposes.find((x) => x.id === g.purposeId)!
                const left = daysUntil(g.expiresAt)
                const prev = g.previousGrantId ? s.grants.find((x) => x.id === g.previousGrantId) : null
                const successors = s.grants.filter((x) => x.previousGrantId === g.id)
                return (
                  <tr key={g.id} className={st === 'reconfirming' ? 'row-warn' : st === 'expired' ? 'row-danger' : ''}>
                    <td className="mono">
                      <b>{g.no}</b>
                      <div className="small muted">来源申请 {s.apps.find((a) => a.id === g.sourceAppId)?.no}</div>
                      {prev && <div className="small" style={{ color: 'var(--purple)' }}><GitCommitHorizontal size={12} style={{ verticalAlign: -2 }} /> 取代上一版 {prev.no}</div>}
                      {successors.map((su) => (
                        <div key={su.id} className="small" style={{ color: 'var(--purple)' }}><History size={12} style={{ verticalAlign: -2 }} /> 新版本 {su.no}</div>
                      ))}
                    </td>
                    <td className="small">{ds.name}<div className="muted mono">{ds.tableName}</div></td>
                    <td className="small">{c.name}<div className="muted">{c.kind === 'report' ? '报表' : '任务'} · {c.system}</div></td>
                    <td className="small" style={{ maxWidth: 230 }}>
                      {g.fieldIds.map((fid) => {
                        const f = s.fields.find((x) => x.id === fid)
                        return (
                          <span key={fid} className="pill-group" style={{ display: 'inline-flex', margin: '0 5px 4px 0' }}>
                            <span className="mono">{f?.name || '?'} </span>
                            {f && <Badge text={f.sensitivity} tone={sensBadge(f.sensitivity).tone} />}
                            {f?.status === 'deleted' && <Badge text="已删" tone="red" />}
                          </span>
                        )
                      })}
                    </td>
                    <td className="small">{p.name}<div className="muted">上限 {p.maxSensitivity}</div></td>
                    <td>
                      <Badge text={lab.text} tone={lab.tone} />
                      {g.reconfirmReason && <div className="small" style={{ color: 'var(--amber)', marginTop: 5, maxWidth: 210 }}>{g.reconfirmReason}</div>}
                      {g.revokeReason && <div className="small muted" style={{ marginTop: 5, maxWidth: 210 }}>{g.revokeReason}</div>}
                    </td>
                    <td className="small muted">
                      批准 {fmtDate(g.approvedAt)}<br />到期 {fmtDate(g.expiresAt)}
                      {st === 'active' && left !== null && left <= 30 && <div style={{ color: 'var(--amber)' }}>剩 {left} 天到期</div>}
                      {st === 'expired' && <div style={{ color: 'var(--red)' }}>已过期 · 需重新申请</div>}
                      <div>批准人：{s.users.find((u) => u.id === g.approvedBy)?.name}</div>
                    </td>
                    <td>
                      <div className="btn-row">
                        <button className="btn ghost sm" onClick={() => setTimelineSourceApp(g.sourceAppId)}>全链路记录</button>
                        {st === 'reconfirming' && <button className="btn sm primary" onClick={() => setReconfirmId(g.id)}><RefreshCw size={13} />重新确认</button>}
                        {st === 'expired' && <button className="btn sm" onClick={() => reapplyFromGrant(g.id)}><RotateCcw size={13} />到期重申</button>}
                        {(st === 'active' || st === 'reconfirming') && <button className="btn ghost sm danger" onClick={() => setRevokeId(g.id)}><Ban size={13} />撤销</button>}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {rows.length === 0 && <Empty text="该状态下暂无授权记录" />}
        </div>
      </div>

      {revokeGrantObj && <RevokeModal grantId={revokeGrantObj.id} grantNo={revokeGrantObj.no} onClose={() => setRevokeId(null)} />}
      {reconfirmObj && <ReconfirmModal grant={reconfirmObj} onClose={() => setReconfirmId(null)} />}
      {timelineApp && (
        <Modal wide title={`全链路处理记录 · ${timelineApp.no}`} onClose={() => setTimelineSourceApp(null)}>
          <Timeline app={timelineApp} />
          <div className="muted small" style={{ marginTop: 10 }}>记录时间：{fmtDateTime(new Date().toISOString())}</div>
        </Modal>
      )}
    </>
  )
}

function RevokeModal({ grantId, grantNo, onClose }: { grantId: string; grantNo: string; onClose: () => void }) {
  const [reason, setReason] = useState('')
  const [err, setErr] = useState('')
  return (
    <Modal
      title={`撤销授权 ${grantNo}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>取消</button>
          <button className="btn danger" onClick={() => {
            if (!reason.trim()) { setErr('撤销必须填写原因'); return }
            revokeGrant(grantId, reason.trim()); onClose()
          }}>确认撤销</button>
        </>
      }
    >
      <div className="callout danger">
        撤销后该消费方立即失去对应字段的使用授权，来源申请同步置为「已撤销」，动作与原因写入处理记录。
      </div>
      <div className="field" style={{ marginTop: 14 }}>
        <label>撤销原因</label>
        <textarea className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="如：业务下线 / 负责人要求收回 / 合规整改…" />
      </div>
      {err && <div className="error-text">{err}</div>}
    </Modal>
  )
}
