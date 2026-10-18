import type { Toast, ToastKind } from '../types/ui'
import { createStore } from '../utils/store'

export const toastStore = createStore<Toast[]>([])

let nextId = 1
const MAX_VISIBLE = 4

export function showToast(kind: ToastKind, title: string, message?: string, duration = 3600): number {
  const id = nextId++
  const toast: Toast = { id, kind, title, duration, ...(message !== undefined ? { message } : {}) }
  toastStore.set((prev) => [...prev, toast].slice(-MAX_VISIBLE))
  window.setTimeout(() => dismissToast(id), duration)
  return id
}

export function dismissToast(id: number): void {
  toastStore.set((prev) => (prev.some((t) => t.id === id) ? prev.filter((t) => t.id !== id) : prev))
}
