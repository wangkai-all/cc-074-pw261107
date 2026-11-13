import { useMemo, useState } from 'react'
import { Plus, Search, ShieldAlert, FileSpreadsheet, Cpu, ChevronRight } from 'lucide-react'
import type { Route } from './AppShell'
import {
  activeConsumersOfDataset, addDataset, effectiveStatus, useStore,
} from '../store'
import { Badge, Empty, Modal, PageHeader } from './ui'
import { NewAppModal } from './forms'
import { daysUntil } from '../utils/format'

export function DatasetsPage({ navigate }: { navigate: (r: Route) => void }) {
  const s = useStore()
  const [q, setQ] = useState('')
  const [showNewDs, setShowNewDs] = useState(false)
  const [showNewApp, setShowNewApp] = useState(false)

  const list = useMemo(() => {
    const kw = q.trim().toLowerCase()
    if (!kw) return s.datasets
    return s.datasets.filter((d) =>
      [d.name, d.tableName, d.domain, d.description].some((x) => x.toLowerCase().includes(kw)))
  }, [s.datasets, q])

  const expiringSoon = s.grants.filter((g) => {
    const st = effectiveStatus(s, g)
    const d = daysUntil(g.expiresAt)
    return (st === 'active') && d !== null && d <= 30
  }).length
  const reconfirming = s.grants.filter((g) => effectiveStatus(s, g) === 'reconfirming').length
  const pending = s.apps.filter((a) => a.status === 'pending').length

  return (
    <>
      <PageHeader
        title="数据集登记"
        desc="维护数据集字段、敏感级别、负责人与已批准的下游用途；详情页可查看正在使用它的报表与任务。"
        actions={
          <>
            <button className="btn" onClick={() => setShowNewApp(true)}><Plus size={15} />新消费申请</button>
            <button className="btn primary" onClick={() => setShowNewDs(true)}><Plus size={15} />登记数据集</button>
          </>
        }
      />

      <div className="stat-grid">
        <div className="stat"><div className="num">{s.datasets.length}</div><div className="lbl">登记数据集</div></div>
        <div className="stat"><div className="num">{s.fields.filter((f) => f.status === 'active').length}</div><div className="lbl">在用字段</div></div>
        <div className="stat"><div className="num warn">{reconfirming}</div><div className="lbl">授权待重新确认</div></div>
        <div className="stat"><div className="num danger">{expiringSoon + pending}</div><div className="lbl">30 天内到期授权 + 待审批</div></div>
      </div>

      <div className="card">
        <div className="filter-bar">
          <div className="input search-input flex" style={{ gap: 8 }}>
            <Search size={15} className="muted" />
            <input
              style={{ border: 0, outline: 'none', flex: 1, background: 'transparent' }}
              placeholder="搜索数据集名称 / 物理表名 / 域"
              value={q} onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </div>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>数据集</th><th>物理表</th><th>数据域</th><th>负责人</th>
                <th>字段数</th><th>使用中的消费方</th><th>风险提示</th><th></th>
              </tr>
            </thead>
            <tbody>
              {list.map((d) => {
                const owner = s.users.find((u) => u.id === d.ownerId)
                const fields = s.fields.filter((f) => f.datasetId === d.id)
                const consumers = activeConsumersOfDataset(s, d.id)
                const grants = s.grants.filter((g) => g.datasetId === d.id)
                const reconf = grants.filter((g) => effectiveStatus(s, g) === 'reconfirming').length
                const l4 = fields.filter((f) => f.sensitivity === 'L4' && f.status === 'active').length
                return (
                  <tr key={d.id} className="clickable" onClick={() => navigate({ name: 'dataset-detail', id: d.id })}>
                    <td>
                      <b>{d.name}</b>
                      <div className="muted small">{d.description}</div>
                    </td>
                    <td className="mono small">{d.tableName}</td>
                    <td><Badge text={d.domain} tone="blue" /></td>
                    <td>{owner?.name}<div className="muted small">{owner?.dept}</div></td>
                    <td>{fields.length} <span className="muted small">（L4 × {l4}）</span></td>
                    <td>
                      <div className="pill-group">
                        {consumers.length === 0 && <span className="muted small">暂无</span>}
                        {consumers.map((c) => (
                          <span key={c.id} className="chip small" style={{ padding: '3px 9px' }}>
                            {c.kind === 'report' ? <FileSpreadsheet size={12} style={{ verticalAlign: -2 }} /> : <Cpu size={12} style={{ verticalAlign: -2 }} />}
                            {c.name}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td>
                      {reconf > 0 && <div style={{ marginBottom: 4 }}><Badge text={`${reconf} 条授权待重新确认`} tone="amber" /></div>}
                      {l4 > 0 && <Badge text={`含 ${l4} 个高敏字段`} tone="red" />}
                      {reconf === 0 && l4 === 0 && <ShieldAlert size={15} className="muted" />}
                    </td>
                    <td><ChevronRight size={16} className="muted" /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {list.length === 0 && <Empty text="没有匹配的数据集" />}
        </div>
      </div>

      {showNewDs && <NewDatasetModal onClose={() => setShowNewDs(false)} />}
      {showNewApp && <NewAppModal s={s} onClose={() => setShowNewApp(false)} />}
    </>
  )
}

function NewDatasetModal({ onClose }: { onClose: () => void }) {
  const s = useStore()
  const [form, setForm] = useState({ name: '', tableName: '', domain: '', ownerId: s.users[0].id, description: '' })
  const [err, setErr] = useState('')
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value })

  return (
    <Modal
      title="登记数据集"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>取消</button>
          <button className="btn primary" onClick={() => {
            if (!form.name.trim() || !form.tableName.trim()) { setErr('数据集名称和物理表名必填'); return }
            if (s.datasets.some((d) => d.tableName === form.tableName.trim())) { setErr('物理表名已存在'); return }
            addDataset({ ...form, name: form.name.trim(), tableName: form.tableName.trim() }); onClose()
          }}>保存</button>
        </>
      }
    >
      <div className="form-grid-2">
        <div className="field"><label>数据集名称</label><input className="input" value={form.name} onChange={set('name')} placeholder="如：客户主数据" /></div>
        <div className="field"><label>物理表名</label><input className="input mono" value={form.tableName} onChange={set('tableName')} placeholder="如：dwd_xxx" /></div>
        <div className="field"><label>数据域</label><input className="input" value={form.domain} onChange={set('domain')} placeholder="如：客户域" /></div>
        <div className="field">
          <label>负责人</label>
          <select className="input" value={form.ownerId} onChange={set('ownerId')}>
            {s.users.map((u) => <option key={u.id} value={u.id}>{u.name} · {u.dept}</option>)}
          </select>
        </div>
      </div>
      <div className="field"><label>说明</label><textarea className="input" value={form.description} onChange={set('description')} /></div>
      {err && <div className="error-text">{err}</div>}
    </Modal>
  )
}
