import type { Sensitivity } from '../types'
export const SENS_ORDER: Record<Sensitivity, number> = { L1: 1, L2: 2, L3: 3, L4: 4 }

export const SENS_META: Record<Sensitivity, { label: string; tone: 'neutral' | 'blue' | 'amber' | 'red'; hint: string }> = {
  L1: { label: 'L1 公开级', tone: 'neutral', hint: '可公开或低敏感标识类信息' },
  L2: { label: 'L2 内部级', tone: 'blue', hint: '内部经营数据，泄露影响有限' },
  L3: { label: 'L3 敏感级', tone: 'amber', hint: '个人敏感信息或核心经营数据' },
  L4: { label: 'L4 高敏级', tone: 'red', hint: '证件/账号/薪酬等强监管信息' },
}

export function fmtDateTime(iso: string): string {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

export function fmtDate(iso: string | null): string {
  if (!iso) return '长期有效'
  return iso.slice(0, 10)
}

export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((new Date(toIso).getTime() - new Date(fromIso).getTime()) / 86400000)
}

export function isExpired(expiresAt: string | null, nowIso = new Date().toISOString()): boolean {
  return !!expiresAt && new Date(expiresAt).getTime() < new Date(nowIso).getTime()
}

export function daysUntil(expiresAt: string | null): number | null {
  if (!expiresAt) return null
  return daysBetween(new Date().toISOString(), expiresAt)
}

export function downloadText(filename: string, content: string, mime = 'text/csv;charset=utf-8') {
  const blob = new Blob(['﻿' + content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function csvCell(v: string | number | null | undefined): string {
  const s = v == null ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
