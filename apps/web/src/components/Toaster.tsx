import { ToastProvider, ToastViewport, Toast, ToastTitle, ToastDescription, ToastClose } from './ui/toast'
import { useToasts } from '@/hooks/useToast'

export function Toaster() {
  const { toasts, dismiss } = useToasts()
  return (
    <ToastProvider>
      {toasts.map(t => (
        <Toast key={t.id} variant={t.variant} onOpenChange={(open) => !open && dismiss(t.id)}>
          <div className="grid gap-1">
            {t.title && <ToastTitle>{t.title}</ToastTitle>}
            {t.description && <ToastDescription>{t.description}</ToastDescription>}
          </div>
          <ToastClose />
        </Toast>
      ))}
      <ToastViewport />
    </ToastProvider>
  )
}
