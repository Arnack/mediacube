import { useState, useCallback } from 'react'

interface ToastItem {
  id: string
  title?: string
  description?: string
  variant?: 'default' | 'destructive'
}

let _toasts: ToastItem[] = []
let _listeners: ((toasts: ToastItem[]) => void)[] = []

function notify() { _listeners.forEach(fn => fn([..._toasts])) }

export function toast(item: Omit<ToastItem, 'id'>) {
  const id = Math.random().toString(36).slice(2)
  _toasts = [..._toasts, { id, ...item }]
  notify()
  setTimeout(() => {
    _toasts = _toasts.filter(t => t.id !== id)
    notify()
  }, 4000)
}

export function useToasts() {
  const [toasts, setToasts] = useState<ToastItem[]>(_toasts)
  useState(() => {
    _listeners.push(setToasts)
    return () => { _listeners = _listeners.filter(l => l !== setToasts) }
  })
  const dismiss = useCallback((id: string) => {
    _toasts = _toasts.filter(t => t.id !== id)
    notify()
  }, [])
  return { toasts, dismiss }
}
