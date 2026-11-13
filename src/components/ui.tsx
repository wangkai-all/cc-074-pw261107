import { type ReactNode, useEffect } from 'react'
import { X, Inbox } from 'lucide-react'
import type { ToastMsg } from '../types'
import { dismissToast } from '../store'

type Tone = 'neutral' | 'blue' | 'amber' | 'red' | 'green' | 'purple'

export function Badge({ text, tone }: { text: string; tone: Tone }) {
  return <span className={`badge ${tone}`}><span className="dot" />{text}</span>
}

export function Modal({
  title, onClose, children, footer, wide,
}: { title: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  return (
    <div className="modal-mask" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal${wide ? ' wide' : ''}`}>
        <div className="modal-head">
          <h3>{title}</h3>
          <div className="spacer" />
          <button className="btn ghost" onClick={onClose} aria-label="关闭"><X size={17} /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  )
}

export function ToastStack({ toasts }: { toasts: ToastMsg[] }) {
  return (
    <div className="toast-stack">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`} onClick={() => dismissToast(t.id)}>
          <span>{t.text}</span>
        </div>
      ))}
    </div>
  )
}

export function Empty({ text }: { text: string }) {
  return (
    <div className="empty">
      <Inbox size={26} style={{ opacity: 0.45 }} />
      <div style={{ marginTop: 6 }}>{text}</div>
    </div>
  )
}

export function PageHeader({ title, desc, actions }: { title: string; desc?: string; actions?: ReactNode }) {
  return (
    <div className="flex top" style={{ marginBottom: 18, alignItems: 'flex-start' }}>
      <div>
        <h2 style={{ fontSize: 19 }}>{title}</h2>
        {desc && <div className="muted small" style={{ marginTop: 4 }}>{desc}</div>}
      </div>
      <div className="spacer" />
      {actions && <div className="btn-row">{actions}</div>}
    </div>
  )
}
