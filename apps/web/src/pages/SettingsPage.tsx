import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { ai } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { toast } from '@/hooks/useToast'

const MODELS = ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo']
const PROMPT_KEYS = ['summarize', 'classify', 'suggestions', 'expand', 'connections'] as const

const LANGS = [
  { code: 'en', label: 'English' },
  { code: 'ru', label: 'Русский' },
  { code: 'zh', label: '中文' },
]

export function SettingsPage() {
  const { t, i18n } = useTranslation()
  const [settings, setSettings] = useState<any>(null)
  const [defaults, setDefaults] = useState<any>(null)
  const [model, setModel] = useState('gpt-4o-mini')
  const [prompts, setPrompts] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    ai.getSettings().then((d: any) => {
      setSettings(d.settings)
      setDefaults(d.defaults)
      setModel(d.settings.model)
      setPrompts(d.settings.prompts)
    })
  }, [])

  async function save() {
    setSaving(true)
    try {
      await ai.updateSettings({ model, prompts })
      toast({ title: t('settings.saved') })
    } catch (err: any) {
      toast({ title: t('settings.failed'), description: err.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  async function reset() {
    if (!confirm(t('settings.resetConfirm'))) return
    await ai.resetSettings()
    const { settings: s } = await ai.getSettings() as any
    setModel(s.model)
    setPrompts(s.prompts)
    toast({ title: t('settings.resetDone') })
  }

  if (!settings) return <div className="p-4 text-sm text-muted-foreground">{t('common.loading')}</div>

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-4 py-3 flex items-center justify-between">
        <h1 className="text-base font-medium">{t('settings.title')}</h1>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={reset}>{t('settings.resetDefaults')}</Button>
          <Button size="sm" onClick={save} disabled={saving}>{saving ? t('settings.saving') : t('settings.save')}</Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">

          {/* Language — shown on mobile only (desktop has it in sidebar) */}
          <div className="md:hidden">
            <h2 className="text-sm font-medium mb-2">Language</h2>
            <div className="flex gap-2">
              {LANGS.map(l => (
                <button
                  key={l.code}
                  onClick={() => { i18n.changeLanguage(l.code); localStorage.setItem('lang', l.code) }}
                  className={`text-sm px-3 py-1.5 rounded border ${i18n.language === l.code ? 'bg-primary text-primary-foreground' : 'hover:bg-secondary'}`}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </div>

          <Separator className="md:hidden" />

          <div>
            <h2 className="text-sm font-medium mb-2">{t('settings.aiModel')}</h2>
            <div className="flex gap-2 flex-wrap">
              {MODELS.map(m => (
                <button
                  key={m}
                  onClick={() => setModel(m)}
                  className={`text-sm px-3 py-1.5 rounded-md border transition-colors ${model === m ? 'bg-primary text-primary-foreground' : 'hover:bg-secondary'}`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <Separator />

          <div className="space-y-5">
            <h2 className="text-sm font-medium">{t('settings.aiPrompts')}</h2>
            {PROMPT_KEYS.map(key => (
              <div key={key}>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium capitalize">{key}</label>
                  {defaults?.prompts[key] !== prompts[key] && (
                    <button
                      className="text-xs text-muted-foreground hover:text-foreground"
                      onClick={() => setPrompts(p => ({ ...p, [key]: defaults.prompts[key] }))}
                    >
                      {t('settings.reset')}
                    </button>
                  )}
                </div>
                <Textarea
                  value={prompts[key] ?? ''}
                  onChange={e => setPrompts(p => ({ ...p, [key]: e.target.value }))}
                  className="text-xs font-mono min-h-[100px] resize-y"
                />
              </div>
            ))}
          </div>
        </div>
      </ScrollArea>
    </div>
  )
}
