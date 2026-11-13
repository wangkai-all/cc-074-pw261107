import { useMemo, useState } from 'react'
import { Plus, Copy, Clock, CheckCircle2 } from 'lucide-react'
import type { Route } from './AppShell'
import {
  cancelApp, duplicateGroups, pendingAppsForUser, useCurrentUserId, useStore,
} from '../store'
import { Badge, Empty, Modal, PageHeader } from './ui'
import { NewAppModal, Timeline, ApproveModal } from './forms'
import { appStatusLabel } from '../labels'
import { fmtDateTime } from '../utils/format'
import { exportAppTimeline } from '../utils/export'

type View = 'todo' | 'all' | 'dupes'

export function AppsPage({ navigate }: { navigate: (r: Route) => void }) {
  const s = useStore()
  const uid = useCurrentUserId()
  const [view, setView] = useState<View>('todo')
  const [showNew, setShowNew] = useState(false)
  const [approveId, setApproveId] = useState<string | null>(null)
  const [timelineId, setTimelineId] = useState<string | null>(null)

  const myPending = pendingAppsForUser(s, uid)
  const groups = duplicateGroups(s)
  const dupIds = new Set(groups.flatMap((g) => g.apps.map((a) => a.id)))

  const list = useMemo(() => {
    const all = [...s.apps].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    if (view === 'todo') return all.filter((a) => myPending.some((p) => p.id === a.id))
    if (view === 'dupes') return all.filter((a) => dupIds.has(a.id))
    return all
  }, [s.apps, view, myPending, dupIds])

  const approveApp = approveId ? s.apps.find((a) => a.id === approveId) : null
  const timelineApp = timelineId ? s.apps.find((a) => a.id === timelineId) : null

  return (
    <>
      <PageHeader
        title="消费申请审批"
        desc="新申请选择具体字段与使用目的；负责人按数据集自动归属，负责人变更后待办自动转交。重复申请合并显示，但各自保留完整处理记录。"
        actions={<button className="btn primary" onClick={() => setShowNew(true)}><Plus size={15} />新消费申请</button>}
      />

      <div className="stat-grid">
        <div className="stat"><div className="num warn">{myPending.length}</div><div className="lbl">待我审批（按我负责的数据集）</div></div>
        <div className="stat"><div className="num">{s.apps.filter((a) => a.status === 'pending').length}</div><div className="lbl">全部待审批</div></div>
        <div className="stat"><div className="num">{groups.length}</div><div className="lbl">重复申请分组</div></div>
        <div className="stat"><div className="num">{s.apps.filter((a) => a.status === 'approved').length}</div><div className="lbl">累计已批准</div></div>
      </div>

      <div className="tabs">
        <button className={`tab${view === 'todo' ? ' active' : ''}`} onClick={() => setView('todo')}><Clock size={13} style={{ verticalAlign: -2 }} /> 待我审批<span className="n">{myPending.length}</span></button>
        <button className={`tab${view === 'all' ? ' active' : ''}`} onClick={() => setView('all')}>全部申请<span className="n">{s.apps.length}</span></button>
        <button className={`tab${view === 'dupes' ? ' active' : ''}`} onClick={() => setView('dupes')}><Copy size={13} style={{ verticalAlign: -2 }} /> 重复申请合并视图<span className="n">{groups.length}</span></button>
      </div>

      {view !== 'dupes' ? (
        <div className="card">
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr><th>申请编号</th><th>数据集</th><th>消费方</th><th>字段 / 用途</th><th>申请人</th><th>状态</th><th>提交时间</th><th>操作</th></tr>
              </thead>
              <tbody>
                {list.map((a) => {
                  const ds = s.datasets.find((d) => d.id === a.datasetId)!
                  const c = s.consumers.find((x) => x.id === a.consumerId)!
                  const p = s.purposes.find((x) => x.id === a.purposeId)!
                  const applicant = s.users.find((u) => u.id === a.applicantId)!
                  const lab = appStatusLabel(a.status)
                  const isDup = dupIds.has(a.id)
                  const primary = a.status === 'duplicate' ? s.apps.find((x) => x.id === a.mergedIntoId) : null
                  return (
                    <tr key={a.id} className={a.status === 'pending' ? 'row-warn' : ''}>
                      <td className="mono"><b>{a.no}</b>
                        {isDup && <div className="dupe-tag" style={{ marginTop: 4 }}>重复组</div>}
                        {primary && <div className="small muted" style={{ marginTop: 3 }}>并入 {primary.no}</div>}
                      </td>
                      <td className="small" style={{ cursor: 'pointer', color: 'var(--primary)' }}
                        onClick={() => navigate({ name: 'dataset-detail', id: ds.id })}>{ds.name}</td>
                      <td className="small">{c.name}<div className="muted">{c.kind === 'report' ? '报表' : '任务'}</div></td>
                      <td className="small">{a.fieldIds.length} 个字段<div className="muted">{p.name}</div></td>
                      <td className="small">{applicant.name}</td>
                      <td><Badge text={lab.text} tone={lab.tone} /></td>
                      <td className="small muted">{fmtDateTime(a.createdAt)}</td>
                      <td>
                        <div className="btn-row">
                          <button className="btn ghost sm" onClick={() => setTimelineId(a.id)}>处理记录</button>
                          {a.status === 'pending' && myPending.some((p2) => p2.id === a.id) && (
                            <button className="btn sm primary" onClick={() => setApproveId(a.id)}>审批</button>
                          )}
                          {a.status === 'pending' && a.applicantId === uid && (
                            <button className="btn ghost sm" onClick={() => cancelApp(a.id)}>撤回</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {list.length === 0 && <Empty text={view === 'todo' ? '当前身份下没有待审批事项' : '暂无申请'} />}
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="callout info">
            <Copy size={15} /> 同一数据集 + 同一消费方 + 完全相同的字段集合 + 同一用途视为重复申请。系统自动并入主单统一审批，但每条申请的提交、合并、审批记录各自保留。
          </div>
          {groups.length === 0 && <Empty text="暂无重复申请" />}
          {groups.map((g) => {
            const primary = g.apps.find((a) => a.status !== 'duplicate') || g.apps[0]
            const ds = s.datasets.find((d) => d.id === primary.datasetId)!
            const c = s.consumers.find((x) => x.id === primary.consumerId)!
            return (
              <div key={g.key} className="chip" style={{ marginTop: 12 }}>
                <div className="flex">
                  <CheckCircle2 size={16} color="var(--amber)" />
                  <b>{ds.name} × {c.name}</b>
                  <span className="spacer" />
                  <Badge text={`${g.apps.length} 条重复申请`} tone="purple" />
                </div>
                <table className="data" style={{ marginTop: 10 }}>
                  <thead><tr><th>申请编号</th><th>申请人</th><th>说明</th><th>状态</th><th>提交时间</th><th></th></tr></thead>
                  <tbody>
                    {g.apps.map((a) => {
                      const applicant = s.users.find((u) => u.id === a.applicantId)!
                      const lab = appStatusLabel(a.status)
                      return (
                        <tr key={a.id}>
                          <td className="mono small"><b>{a.no}</b>{a.id === primary.id && <span className="muted">（主单）</span>}</td>
                          <td className="small">{applicant.name}</td>
                          <td className="small muted" style={{ maxWidth: 260 }}>{a.reason}</td>
                          <td><Badge text={lab.text} tone={lab.tone} /></td>
                          <td className="small muted">{fmtDateTime(a.createdAt)}</td>
                          <td><button className="btn ghost sm" onClick={() => setTimelineId(a.id)}>各自处理记录</button></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )
          })}
        </div>
      )}

      {showNew && <NewAppModal s={s} onClose={() => setShowNew(false)} />}
      {approveApp && <ApproveModal app={approveApp} onClose={() => setApproveId(null)} />}
      {timelineApp && (
        <Modal wide title={`处理记录 · ${timelineApp.no}`} onClose={() => setTimelineId(null)}
          footer={<><button className="btn" onClick={() => exportAppTimeline(s, timelineApp.id)}>导出处理记录 CSV</button>
            <button className="btn primary" onClick={() => setTimelineId(null)}>关闭</button></>}>
          <Timeline app={timelineApp} />
        </Modal>
      )}
    </>
  )
}
