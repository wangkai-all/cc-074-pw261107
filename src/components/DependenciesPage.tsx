import { useMemo, useState } from 'react'
import { ArrowRight, FileSpreadsheet, Cpu, Search, AlertTriangle } from 'lucide-react'
import { effectiveStatus, fieldDatasetId, useStore } from '../store'
import { Badge, Empty, PageHeader } from './ui'
import { FIELD_STATUS_LABEL, grantStatusLabel, sensBadge } from '../labels'
import type { Route } from './AppShell'

export function DependenciesPage({ navigate }: { navigate: (r: Route) => void }) {
  const s = useStore()
  const [dsId, setDsId] = useState('all')
  const [kw, setKw] = useState('')
  const [onlyRisk, setOnlyRisk] = useState(false)

  const rows = useMemo(() => {
    return s.fields
      .filter((f) => dsId === 'all' || fieldDatasetId(s, f.id) === dsId)
      .filter((f) => !kw || f.name.toLowerCase().includes(kw.toLowerCase()))
      .map((f) => {
        const ds = s.datasets.find((d) => d.id === fieldDatasetId(s, f.id))!
        const refGrants = s.grants.filter((g) => g.fieldIds.includes(f.id))
        const consumers = new Map<string, { consumerId: string; grantIds: string[] }>()
        refGrants.forEach((g) => {
          const cur = consumers.get(g.consumerId) || { consumerId: g.consumerId, grantIds: [] }
          cur.grantIds.push(g.id)
          consumers.set(g.consumerId, cur)
        })
        const risk = f.status !== 'active' || refGrants.some((g) => effectiveStatus(s, g) === 'reconfirming')
        return { field: f, ds, refGrants, consumers: [...consumers.values()], risk }
      })
      .filter((r) => !onlyRisk || r.risk)
      .sort((a, b) => Number(b.risk) - Number(a.risk))
  }, [s, dsId, kw, onlyRisk])

  return (
    <>
      <PageHeader
        title="字段依赖视图"
        desc="从字段出发的反向血缘：每个字段被哪些授权引用、流向哪些报表或任务。字段删改时据此定位全部受影响消费方。"
      />
      <div className="card">
        <div className="filter-bar">
          <select className="input" value={dsId} onChange={(e) => setDsId(e.target.value)}>
            <option value="all">全部数据集</option>
            {s.datasets.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <div className="input search-input flex" style={{ gap: 8 }}>
            <Search size={15} className="muted" />
            <input style={{ border: 0, outline: 'none', flex: 1, background: 'transparent' }}
              placeholder="按字段名搜索" value={kw} onChange={(e) => setKw(e.target.value)} />
          </div>
          <label className="flex small" style={{ gap: 6, cursor: 'pointer' }}>
            <input type="checkbox" checked={onlyRisk} onChange={(e) => setOnlyRisk(e.target.checked)} />
            只看有变更/待确认风险的字段
          </label>
        </div>

        {rows.length === 0 && <Empty text="没有符合条件的字段" />}
        {rows.map(({ field, ds, refGrants, consumers, risk }) => (
          <div key={field.id} className="chip" style={{ marginBottom: 12, borderColor: risk ? 'var(--amber)' : undefined }}>
            <div className="flex top" style={{ alignItems: 'flex-start' }}>
              <div style={{ minWidth: 250 }}>
                <div className="flex">
                  <b className="mono">{field.name}</b>
                  <Badge {...sensBadge(field.sensitivity)} />
                  {field.status !== 'active' && <Badge text={FIELD_STATUS_LABEL[field.status].text} tone={FIELD_STATUS_LABEL[field.status].tone} />}
                </div>
                <div className="muted small" style={{ marginTop: 5 }}>{field.type} · {ds.name}</div>
                <div className="muted small">{field.description}</div>
                {field.changeNote && (
                  <div className="callout warn" style={{ marginTop: 8, padding: '7px 10px' }}>
                    <AlertTriangle size={13} /> {field.changeNote}
                  </div>
                )}
              </div>
              <ArrowRight size={16} className="dep-arrow" style={{ marginTop: 6 }} />
              <div style={{ flex: 1 }}>
                {consumers.length === 0 && <span className="muted small">暂无下游消费方</span>}
                <div className="pill-group">
                  {consumers.map(({ consumerId, grantIds }) => {
                    const c = s.consumers.find((x) => x.id === consumerId)!
                    const stSet = new Set(grantIds.map((gid) => effectiveStatus(s, s.grants.find((g) => g.id === gid)!)))
                    const blocked = stSet.has('reconfirming')
                    return (
                      <span key={consumerId} className="chip small" style={{ borderColor: blocked ? 'var(--amber)' : undefined }}>
                        <div className="flex" style={{ gap: 6 }}>
                          {c.kind === 'report' ? <FileSpreadsheet size={14} color="var(--blue)" /> : <Cpu size={14} color="var(--purple)" />}
                          <b>{c.name}</b>
                        </div>
                        <div className="small muted" style={{ margin: '4px 0' }}>{c.system} · 负责人 {s.users.find((u) => u.id === c.ownerId)?.name}</div>
                        <div className="pill-group">
                          {grantIds.map((gid) => {
                            const g = s.grants.find((x) => x.id === gid)!
                            const st = effectiveStatus(s, g)
                            return <Badge key={gid} text={`${g.no} · ${grantStatusLabel(st).text}`} tone={grantStatusLabel(st).tone} />
                          })}
                        </div>
                      </span>
                    )
                  })}
                </div>
                <div className="small muted" style={{ marginTop: 8 }}>
                  共 {refGrants.length} 条授权引用（含历史），{consumers.length} 个消费方
                  <a style={{ marginLeft: 10, cursor: 'pointer' }} onClick={() => navigate({ name: 'dataset-detail', id: ds.id })}>前往数据集详情 →</a>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
