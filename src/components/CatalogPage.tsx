import { useState } from 'react'
import { Plus, Power, FileSpreadsheet, Cpu } from 'lucide-react'
import type { Sensitivity } from '../types'
import {
  addConsumer, setPurposeMaxSensitivity, togglePurposeActive, useStore,
} from '../store'
import { Badge, Empty, Modal, PageHeader } from './ui'
import { SENS_META } from '../utils/format'

export function CatalogPage() {
  const s = useStore()
  const [showConsumer, setShowConsumer] = useState(false)

  return (
    <>
      <PageHeader
        title="目录管理"
        desc="维护已批准的下游用途目录与消费方（报表/任务）。用途敏感级别下调或停用，会自动找出超出新约束的授权并转入重新确认。"
        actions={<button className="btn primary" onClick={() => setShowConsumer(true)}><Plus size={15} />登记消费方</button>}
      />

      <div className="card">
        <div className="card-head"><h3>已批准下游用途目录</h3></div>
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th>用途</th><th>分类</th><th>最高敏感级别</th><th>状态</th><th>说明</th><th>调整级别影响面</th><th>操作</th></tr></thead>
            <tbody>
              {s.purposes.map((p) => {
                const usingGrants = s.grants.filter((g) => g.purposeId === p.id)
                const liveGrants = usingGrants.filter((g) => ['active', 'reconfirming'].includes(g.status))
                return (
                  <tr key={p.id} className={!p.active ? 'row-danger' : ''}>
                    <td><b>{p.name}</b></td>
                    <td><Badge text={p.category} tone="blue" /></td>
                    <td>
                      <select className="input sm" style={{ width: 130 }}
                        value={p.maxSensitivity}
                        onChange={(e) => setPurposeMaxSensitivity(p.id, e.target.value as Sensitivity)}>
                        {(['L1', 'L2', 'L3', 'L4'] as Sensitivity[]).map((lv) => <option key={lv} value={lv}>{SENS_META[lv].label}</option>)}
                      </select>
                    </td>
                    <td>{p.active ? <Badge text="启用中" tone="green" /> : <Badge text="已停用" tone="red" />}</td>
                    <td className="small muted" style={{ maxWidth: 260 }}>{p.description}</td>
                    <td className="small">{usingGrants.length} 条授权引用（生效/待确认 {liveGrants.length}）
                      <div className="muted">下调级别后，超上限的授权将转入待重新确认</div>
                    </td>
                    <td>
                      <button className="btn sm" onClick={() => togglePurposeActive(p.id)}>
                        <Power size={13} />{p.active ? '停用' : '重新启用'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="card-head"><h3>消费方目录（报表 / 任务）</h3></div>
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th>消费方</th><th>类型</th><th>所属系统</th><th>负责人</th><th>说明</th><th>持有授权</th></tr></thead>
            <tbody>
              {s.consumers.map((c) => {
                const owner = s.users.find((u) => u.id === c.ownerId)
                const grants = s.grants.filter((g) => g.consumerId === c.id)
                return (
                  <tr key={c.id}>
                    <td><b>{c.name}</b></td>
                    <td><Badge text={c.kind === 'report' ? '报表' : '任务'} tone={c.kind === 'report' ? 'blue' : 'purple'} />
                      <span style={{ marginLeft: 6 }}>{c.kind === 'report' ? <FileSpreadsheet size={13} className="muted" /> : <Cpu size={13} className="muted" />}</span>
                    </td>
                    <td className="small">{c.system}</td>
                    <td className="small">{owner?.name}<div className="muted">{owner?.dept}</div></td>
                    <td className="small muted" style={{ maxWidth: 280 }}>{c.description}</td>
                    <td className="small">{grants.length} 条（生效 {grants.filter((g) => g.status === 'active').length}）</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {s.consumers.length === 0 && <Empty text="暂无消费方" />}
        </div>
      </div>

      <div className="card">
        <div className="card-head"><h3>人员目录（虚构）</h3></div>
        <div className="grid-2">
          {s.users.map((u) => (
            <div key={u.id} className="chip flex">
              <div className="avatar">{u.name.slice(0, 1)}</div>
              <div>
                <b>{u.name}</b>
                <div className="muted small">{u.title} · {u.dept}</div>
                <div className="small muted mono">{u.id}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {showConsumer && <NewConsumerModal onClose={() => setShowConsumer(false)} />}
    </>
  )
}

function NewConsumerModal({ onClose }: { onClose: () => void }) {
  const s = useStore()
  const [form, setForm] = useState({ name: '', kind: 'report' as 'report' | 'task', ownerId: s.users[4]?.id || s.users[0].id, system: '', description: '' })
  const [err, setErr] = useState('')
  return (
    <Modal
      title="登记消费方"
      onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>取消</button>
        <button className="btn primary" onClick={() => {
          if (!form.name.trim() || !form.system.trim()) { setErr('名称与所属系统必填'); return }
          addConsumer({ ...form, name: form.name.trim(), system: form.system.trim() }); onClose()
        }}>保存</button></>}
    >
      <div className="form-grid-2">
        <div className="field"><label>消费方名称</label><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="如：会员运营周报" /></div>
        <div className="field"><label>类型</label>
          <select className="input" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as 'report' | 'task' })}>
            <option value="report">报表</option><option value="task">任务</option>
          </select>
        </div>
        <div className="field"><label>所属系统</label><input className="input" value={form.system} onChange={(e) => setForm({ ...form, system: e.target.value })} placeholder="如：BI 平台" /></div>
        <div className="field"><label>负责人</label>
          <select className="input" value={form.ownerId} onChange={(e) => setForm({ ...form, ownerId: e.target.value })}>
            {s.users.map((u) => <option key={u.id} value={u.id}>{u.name} · {u.dept}</option>)}
          </select>
        </div>
      </div>
      <div className="field"><label>说明</label><textarea className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
      {err && <div className="error-text">{err}</div>}
    </Modal>
  )
}
