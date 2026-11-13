import { type ReactNode } from 'react'
import { Database, FileCheck2, KeyRound, Users2, GitBranch, RotateCcw } from 'lucide-react'
import { pendingAppsForUser, resetAll, setCurrentUser, useCurrentUserId, useStore, useToasts } from '../store'
import { ToastStack } from './ui'

export type Route =
  | { name: 'datasets' }
  | { name: 'dataset-detail'; id: string }
  | { name: 'apps' }
  | { name: 'grants' }
  | { name: 'catalog' }
  | { name: 'dependencies' }

const NAV: { key: Route['name']; label: string; icon: ReactNode }[] = [
  { key: 'datasets', label: '数据集登记', icon: <Database size={17} /> },
  { key: 'apps', label: '消费申请审批', icon: <FileCheck2 size={17} /> },
  { key: 'grants', label: '授权台账', icon: <KeyRound size={17} /> },
  { key: 'dependencies', label: '字段依赖视图', icon: <GitBranch size={17} /> },
  { key: 'catalog', label: '目录管理', icon: <Users2 size={17} /> },
]

export function AppShell({ route, navigate, children }: { route: Route; navigate: (r: Route) => void; children: ReactNode }) {
  const s = useStore()
  const uid = useCurrentUserId()
  const toasts = useToasts()
  const myPending = pendingAppsForUser(s, uid).length

  const crumb = (() => {
    switch (route.name) {
      case 'datasets': return '数据集登记'
      case 'dataset-detail': return `数据集登记 / ${s.datasets.find((d) => d.id === route.id)?.name || '详情'}`
      case 'apps': return '消费申请审批'
      case 'grants': return '授权台账'
      case 'catalog': return '目录管理（用途 / 消费方 / 人员）'
      case 'dependencies': return '字段依赖视图'
    }
  })()

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="logo">档</div>
          <div>
            <b>数据集消费登记台</b>
            <span>虚构目录 · 不接真实权限系统</span>
          </div>
        </div>
        {NAV.map((n) => (
          <button
            key={n.key}
            className={`nav-item${route.name === n.key || (n.key === 'datasets' && route.name === 'dataset-detail') ? ' active' : ''}`}
            onClick={() => navigate({ name: n.key } as Route)}
          >
            {n.icon}{n.label}
            {n.key === 'apps' && myPending > 0 && <span className="count">{myPending}</span>}
          </button>
        ))}
        <div className="foot">
          <button className="nav-item" onClick={() => { if (confirm('确认清空本地改动并恢复示例数据？')) resetAll() }}>
            <RotateCcw size={15} /> 重置示例数据
          </button>
          <p style={{ padding: '8px 12px 0', lineHeight: 1.6 }}>
            数据保存在浏览器 localStorage，仅用于演示登记、审批与授权追踪流程。
          </p>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="crumb small">{crumb}</div>
          <div className="spacer" />
          <div className="identity">
            <div className="avatar">{s.users.find((u) => u.id === uid)?.name.slice(0, 1)}</div>
            <select value={uid} onChange={(e) => setCurrentUser(e.target.value)} title="切换当前操作身份（演示用）">
              {s.users.map((u) => (
                <option key={u.id} value={u.id}>{u.name} · {u.dept}</option>
              ))}
            </select>
          </div>
        </header>
        <main className="content">{children}</main>
      </div>
      <ToastStack toasts={toasts} />
    </div>
  )
}
