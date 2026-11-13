import { useMemo, useState } from 'react'
import {
  ArrowLeft, Plus, Pencil, Trash2, UserCog, FileSpreadsheet, Cpu, RefreshCw, KeyRound,
} from 'lucide-react'
import type { DataField, Grant, Sensitivity } from '../types'
import type { Route } from './AppShell'
import {
  addField, appsOfDataset, changeDatasetOwner, deleteField, effectiveStatus, fieldsOf,
  grantsOfDataset, updateField, useCurrentUserId, useStore,
} from '../store'
import { Badge, Empty, Modal, PageHeader } from './ui'
import { FIELD_STATUS_LABEL, appStatusLabel, grantStatusLabel, sensBadge } from '../labels'
import { SENS_META, daysUntil, fmtDate, fmtDateTime } from '../utils/format'
import { ApproveModal, ReconfirmModal, Timeline } from './forms'
import { exportConsumptionList } from '../utils/export'

type Tab = 'fields' | 'consumers' | 'apps' | 'grants'

export function DatasetDetailPage({ id, navigate }: { id: string; navigate: (r: Route) => void }) {
  const s = useStore()
  const uid = useCurrentUserId()
  const ds = s.datasets.find((d) => d.id === id)
  const [tab, setTab] = useState<Tab>('fields')
  const [editingField, setEditingField] = useState<DataField | null>(null)
  const [addingField, setAddingField] = useState(false)
  const [ownerModal, setOwnerModal] = useState(false)
  const [approveAppId, setApproveAppId] = useState<string | null>(null)
  const [reconfirmGrantId, setReconfirmGrantId] = useState<string | null>(null)
  const [timelineAppId, setTimelineAppId] = useState<string | null>(null)

  if (!ds) return <Empty text="数据集不存在" />
  const fields = fieldsOf(s, id)
  const grants = grantsOfDataset(s, id)
  const apps = appsOfDataset(s, id)
  const owner = s.users.find((u) => u.id === ds.ownerId)!
  const isOwner = uid === ds.ownerId

  const consumerUsage = useMemo(() => {
    const map = new Map<string, { grantIds: string[]; statuses: Set<string> }>()
    grants.forEach((g) => {
      const cur = map.get(g.consumerId) || { grantIds: [], statuses: new Set<string>() }
      cur.grantIds.push(g.id)
      cur.statuses.add(effectiveStatus(s, g))
      map.set(g.consumerId, cur)
    })
    return [...map.entries()].map(([cid, v]) => ({ consumer: s.consumers.find((c) => c.id === cid)!, ...v }))
  }, [grants, s])

  const approveApp = approveAppId ? s.apps.find((a) => a.id === approveAppId) : null
  const reconfirmGrant = reconfirmGrantId ? s.grants.find((g) => g.id === reconfirmGrantId) : null
  const timelineApp = timelineAppId ? s.apps.find((a) => a.id === timelineAppId) : null

  return (
    <>
      <div style={{ marginBottom: 14 }}>
        <span className="back-link" onClick={() => navigate({ name: 'datasets' })}><ArrowLeft size={15} />返回数据集列表</span>
      </div>
      <PageHeader
        title={ds.name}
        desc={`${ds.domain} · 物理表 ${ds.tableName} · 最近更新 ${fmtDateTime(ds.updatedAt)}`}
        actions={
          <>
            <button className="btn" onClick={() => exportConsumptionList(s, id)}>导出消费清单</button>
            <button className="btn" onClick={() => setOwnerModal(true)}><UserCog size={15} />变更负责人</button>
            <button className="btn primary" onClick={() => setAddingField(true)}><Plus size={15} />新增字段</button>
          </>
        }
      />

      <div className="card">
        <div className="flex top" style={{ alignItems: 'flex-start' }}>
          <dl className="kv" style={{ flex: 1 }}>
            <dt>负责人</dt><dd>{owner.name}（{owner.title} · {owner.dept}）{isOwner && <Badge text="当前身份即负责人" tone="blue" />}</dd>
            <dt>字段概况</dt><dd>共 {fields.length} 个字段，其中 L3 {fields.filter((f) => f.sensitivity === 'L3').length} 个、L4 {fields.filter((f) => f.sensitivity === 'L4').length} 个；变更 {fields.filter((f) => f.status === 'modified').length}、删除 {fields.filter((f) => f.status === 'deleted').length}</dd>
            <dt>授权概况</dt><dd>生效 {grants.filter((g) => effectiveStatus(s, g) === 'active').length} · 待重新确认 {grants.filter((g) => effectiveStatus(s, g) === 'reconfirming').length} · 到期 {grants.filter((g) => effectiveStatus(s, g) === 'expired').length} · 撤销 {grants.filter((g) => effectiveStatus(s, g) === 'revoked').length}</dd>
          </dl>
        </div>
      </div>

      <div className="tabs" style={{ marginTop: 18 }}>
        <button className={`tab${tab === 'fields' ? ' active' : ''}`} onClick={() => setTab('fields')}>字段依赖{''}<span className="n">{fields.length}</span></button>
        <button className={`tab${tab === 'consumers' ? ' active' : ''}`} onClick={() => setTab('consumers')}>使用中的报表/任务<span className="n">{consumerUsage.length}</span></button>
        <button className={`tab${tab === 'apps' ? ' active' : ''}`} onClick={() => setTab('apps')}>消费申请<span className="n">{apps.length}</span></button>
        <button className={`tab${tab === 'grants' ? ' active' : ''}`} onClick={() => setTab('grants')}>授权记录<span className="n">{grants.length}</span></button>
      </div>

      {tab === 'fields' && (
        <div className="card">
          <div className="callout info">
            字段改名、改类型或调整敏感级别属于结构性变更，会自动把引用该字段的生效授权置为「待重新确认」；删除字段同理。仅改描述不触发复核。
          </div>
          <div className="table-wrap" style={{ marginTop: 12 }}>
            <table className="data">
              <thead><tr><th>字段名</th><th>类型</th><th>敏感级别</th><th>状态 / 变更说明</th><th>描述</th><th>被授权引用</th><th>操作</th></tr></thead>
              <tbody>
                {fields.map((f) => {
                  const refGrants = grants.filter((g) => g.fieldIds.includes(f.id))
                  const activeRefs = refGrants.filter((g) => ['active', 'reconfirming'].includes(effectiveStatus(s, g)))
                  return (
                    <tr key={f.id} className={f.status === 'deleted' ? 'row-danger' : f.status === 'modified' ? 'row-warn' : ''}>
                      <td className="mono"><b>{f.name}</b></td>
                      <td className="mono small muted">{f.type}</td>
                      <td><Badge {...sensBadge(f.sensitivity)} /><div className="muted small" style={{ marginTop: 3 }}>{SENS_META[f.sensitivity].hint}</div></td>
                      <td>
                        <Badge text={FIELD_STATUS_LABEL[f.status].text} tone={FIELD_STATUS_LABEL[f.status].tone} />
                        {f.changeNote && <div className="small" style={{ color: 'var(--amber)', marginTop: 4 }}>{f.changeNote}</div>}
                      </td>
                      <td className="small muted" style={{ maxWidth: 220 }}>{f.description}</td>
                      <td>
                        {activeRefs.length ? <Badge text={`${activeRefs.length} 条生效/待确认授权`} tone="amber" /> : <span className="muted small">{refGrants.length ? '仅历史授权' : '无引用'}</span>}
                      </td>
                      <td>
                        <div className="btn-row">
                          <button className="btn ghost sm" disabled={f.status === 'deleted'} onClick={() => setEditingField(f)}><Pencil size={14} /></button>
                          <button className="btn ghost sm danger" disabled={f.status === 'deleted'} onClick={() => {
                            if (confirm(`删除字段 ${f.name}？引用它的生效授权将转入待重新确认。`)) deleteField(f.id)
                          }}><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'consumers' && (
        <div className="card">
          {consumerUsage.length === 0 && <Empty text="当前没有报表或任务使用该数据集" />}
          <div className="grid-2">
            {consumerUsage.map(({ consumer, grantIds, statuses }) => {
              const cOwner = s.users.find((u) => u.id === consumer.ownerId)
              const cGrants = grantIds.map((gid) => s.grants.find((g) => g.id === gid)!)
              return (
                <div key={consumer.id} className="chip">
                  <div className="flex">
                    {consumer.kind === 'report' ? <FileSpreadsheet size={17} color="var(--blue)" /> : <Cpu size={17} color="var(--purple)" />}
                    <b>{consumer.name}</b>
                    <span className="spacer" />
                    <Badge text={consumer.kind === 'report' ? '报表' : '任务'} tone={consumer.kind === 'report' ? 'blue' : 'purple'} />
                  </div>
                  <div className="muted small" style={{ margin: '6px 0' }}>{consumer.description} · 所属系统：{consumer.system} · 负责人：{cOwner?.name}</div>
                  <div className="pill-group">
                    {cGrants.map((g) => {
                      const st = effectiveStatus(s, g)
                      return (
                        <span key={g.id} className="small flex" style={{ gap: 6 }}>
                          <KeyRound size={12} className="muted" />
                          <span className="mono">{g.no}</span>
                          <Badge text={grantStatusLabel(st).text} tone={grantStatusLabel(st).tone} />
                        </span>
                      )
                    })}
                  </div>
                  {statuses.has('reconfirming') && (
                    <div className="callout warn" style={{ marginTop: 10, padding: '8px 10px' }}>
                      <RefreshCw size={13} /> 该消费方存在待重新确认的授权，继续使用前必须完成确认。
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {tab === 'apps' && (
        <div className="card">
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>申请编号</th><th>消费方</th><th>用途</th><th>字段数</th><th>状态</th><th>提交时间</th><th>操作</th></tr></thead>
              <tbody>
                {apps.map((a) => {
                  const c = s.consumers.find((x) => x.id === a.consumerId)!
                  const p = s.purposes.find((x) => x.id === a.purposeId)!
                  const lab = appStatusLabel(a.status)
                  const dupCount = s.apps.filter((x) => x.dedupeKey === a.dedupeKey).length
                  return (
                    <tr key={a.id} className={a.status === 'pending' ? 'row-warn' : ''}>
                      <td className="mono"><b>{a.no}</b>{dupCount > 1 && <span className="dupe-tag" style={{ marginLeft: 8 }}>重复组 ×{dupCount}</span>}</td>
                      <td>{c.name}</td>
                      <td>{p.name}</td>
                      <td>{a.fieldIds.length}</td>
                      <td><Badge text={lab.text} tone={lab.tone} /></td>
                      <td className="small muted">{fmtDateTime(a.createdAt)}</td>
                      <td>
                        <div className="btn-row">
                          <button className="btn ghost sm" onClick={() => setTimelineAppId(a.id)}>处理记录</button>
                          {a.status === 'pending' && isOwner && <button className="btn sm primary" onClick={() => setApproveAppId(a.id)}>审批</button>}
                          {a.status === 'duplicate' && a.mergedIntoId && (
                            <button className="btn ghost sm" onClick={() => setTimelineAppId(a.mergedIntoId!)}>查看主单</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {apps.length === 0 && <Empty text="暂无消费申请" />}
          </div>
        </div>
      )}

      {tab === 'grants' && (
        <div className="card">
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>授权编号</th><th>消费方</th><th>字段范围</th><th>用途</th><th>状态</th><th>批准/到期</th><th>操作</th></tr></thead>
              <tbody>
                {grants.map((g: Grant) => {
                  const st = effectiveStatus(s, g)
                  const lab = grantStatusLabel(st)
                  const c = s.consumers.find((x) => x.id === g.consumerId)!
                  const p = s.purposes.find((x) => x.id === g.purposeId)!
                  const left = daysUntil(g.expiresAt)
                  const prev = g.previousGrantId ? s.grants.find((x) => x.id === g.previousGrantId) : null
                  return (
                    <tr key={g.id} className={st === 'reconfirming' ? 'row-warn' : st === 'expired' ? 'row-danger' : ''}>
                      <td className="mono"><b>{g.no}</b>{prev && <div className="small muted">新版本，取代 {prev.no}</div>}</td>
                      <td>{c.name}<div className="muted small">{c.kind === 'report' ? '报表' : '任务'}</div></td>
                      <td className="small">
                        {g.fieldIds.map((fid) => {
                          const f = s.fields.find((x) => x.id === fid)
                          return <span key={fid} className="mono" style={{ marginRight: 6 }}>{f?.name || '?'}<span className="muted">[{f?.sensitivity || '?'}]</span></span>
                        })}
                      </td>
                      <td className="small">{p.name}</td>
                      <td><Badge text={lab.text} tone={lab.tone} />
                        {g.reconfirmReason && <div className="small" style={{ color: 'var(--amber)', marginTop: 4, maxWidth: 220 }}>{g.reconfirmReason}</div>}
                        {g.revokeReason && <div className="small muted" style={{ marginTop: 4, maxWidth: 220 }}>{g.revokeReason}</div>}
                      </td>
                      <td className="small muted">
                        批准 {fmtDate(g.approvedAt)}<br />
                        到期 {fmtDate(g.expiresAt)}
                        {st === 'active' && left !== null && left <= 30 && <div style={{ color: 'var(--amber)' }}>剩余 {left} 天</div>}
                        {st === 'expired' && <div style={{ color: 'var(--red)' }}>已过期，不可沿用</div>}
                      </td>
                      <td>
                        <div className="btn-row">
                          <button className="btn ghost sm" onClick={() => setTimelineAppId(g.sourceAppId)}>追踪</button>
                          {st === 'reconfirming' && <button className="btn sm primary" onClick={() => setReconfirmGrantId(g.id)}>重新确认</button>}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {grants.length === 0 && <Empty text="暂无授权记录" />}
          </div>
        </div>
      )}

      {addingField && <FieldEditModal dsId={id} onClose={() => setAddingField(false)} />}
      {editingField && <FieldEditModal dsId={id} field={editingField} onClose={() => setEditingField(null)} />}
      {ownerModal && <OwnerModal dsId={id} currentOwner={ds.ownerId} onClose={() => setOwnerModal(false)} />}
      {approveApp && <ApproveModal app={approveApp} onClose={() => setApproveAppId(null)} />}
      {reconfirmGrant && <ReconfirmModal grant={reconfirmGrant} onClose={() => setReconfirmGrantId(null)} />}
      {timelineApp && (
        <Modal wide title={`处理记录 · ${timelineApp.no}`} onClose={() => setTimelineAppId(null)}>
          <Timeline app={timelineApp} />
        </Modal>
      )}
    </>
  )
}

// ---------------- 字段新增/编辑 ----------------
function FieldEditModal({ dsId, field, onClose }: { dsId: string; field?: DataField; onClose: () => void }) {
  const [name, setName] = useState(field?.name || '')
  const [type, setType] = useState(field?.type || 'STRING')
  const [sensitivity, setSensitivity] = useState<Sensitivity>(field?.sensitivity || 'L1')
  const [description, setDescription] = useState(field?.description || '')
  const [changeNote, setChangeNote] = useState(field?.changeNote || '')
  const [err, setErr] = useState('')

  const save = () => {
    if (!name.trim()) { setErr('字段名必填'); return }
    if (field) {
      updateField(field.id, { name: name.trim(), type, sensitivity, description, changeNote: changeNote || undefined })
    } else {
      addField(dsId, { name: name.trim(), type, sensitivity, description })
    }
    onClose()
  }

  return (
    <Modal
      title={field ? `编辑字段 ${field.name}` : '新增字段'}
      onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>取消</button><button className="btn primary" onClick={save}>保存</button></>}
    >
      <div className="form-grid-2">
        <div className="field"><label>字段名</label><input className="input mono" value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="field">
          <label>类型</label>
          <select className="input mono" value={type} onChange={(e) => setType(e.target.value)}>
            {['STRING', 'BIGINT', 'INT', 'DECIMAL(12,2)', 'DECIMAL(18,2)', 'DATE', 'TIMESTAMP', 'BOOLEAN'].map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
      </div>
      <div className="field">
        <label>敏感级别</label>
        <div className="pill-group">
          {(Object.keys(SENS_META) as Sensitivity[]).map((lv) => (
            <button key={lv} type="button" className={`btn sm${sensitivity === lv ? ' primary' : ''}`} onClick={() => setSensitivity(lv)}>
              {SENS_META[lv].label}
            </button>
          ))}
        </div>
        <div className="hint small" style={{ marginTop: 6 }}>{SENS_META[sensitivity].hint}</div>
      </div>
      <div className="field"><label>业务描述</label><textarea className="input" value={description} onChange={(e) => setDescription(e.target.value)} /></div>
      {field && (
        <div className="field">
          <label>变更说明 <span className="hint">（改名/类型/敏感级别变化时填写，将展示给下游消费方）</span></label>
          <input className="input" value={changeNote} onChange={(e) => setChangeNote(e.target.value)} placeholder="如：口径由含税调整为不含税" />
        </div>
      )}
      {field && <div className="callout warn">保存结构性变更后，引用该字段的生效授权会自动转入「待重新确认」，不会因表名没变而沿用旧授权。</div>}
      {err && <div className="error-text">{err}</div>}
    </Modal>
  )
}

// ---------------- 负责人变更（待审批自动转交） ----------------
function OwnerModal({ dsId, currentOwner, onClose }: { dsId: string; currentOwner: string; onClose: () => void }) {
  const s = useStore()
  const [ownerId, setOwnerId] = useState(currentOwner)
  const pending = s.apps.filter((a) => a.datasetId === dsId && a.status === 'pending')
  return (
    <Modal
      title="变更数据集负责人"
      onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>取消</button>
        <button className="btn primary" disabled={ownerId === currentOwner} onClick={() => { changeDatasetOwner(dsId, ownerId); onClose() }}>确认变更并转交待办</button></>}
    >
      <div className="field">
        <label>新负责人</label>
        <select className="input" value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
          {s.users.map((u) => <option key={u.id} value={u.id}>{u.name} · {u.dept}（{u.title}）</option>)}
        </select>
      </div>
      <div className="callout info">
        变更后该数据集下 <b>{pending.length}</b> 条待审批申请将自动转交给新负责人，并在每条申请的处理记录中留痕；已产生的授权批准人信息保持不变。
      </div>
      {pending.length > 0 && (
        <div className="table-wrap" style={{ marginTop: 10 }}>
          <table className="data">
            <thead><tr><th>待办申请</th><th>消费方</th><th>提交时间</th></tr></thead>
            <tbody>
              {pending.map((a) => (
                <tr key={a.id}>
                  <td className="mono small">{a.no}</td>
                  <td className="small">{s.consumers.find((c) => c.id === a.consumerId)?.name}</td>
                  <td className="small muted">{fmtDateTime(a.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  )
}
