'use client';
import { useEffect, useState } from 'react';
import type { PublicSiteInfo } from '@/lib/site-settings';
import { Alert } from '@/components/ui';

export function usePublicSiteSettings(enabled = true) {
  const [settings, setSettings] = useState<PublicSiteInfo | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    async function load() {
      try {
        const res = await fetch('/api/site-settings', { cache: 'no-store' });
        if (res.ok) { const data = await res.json(); if (active) { setSettings(data); document.title = data.siteName; } }
      } catch { /* Admission is always checked on the server. */ }
    }
    void load();
    const timer = setInterval(load, 30_000);
    window.addEventListener('focus', load);
    window.addEventListener('site-settings-updated', load);
    return () => { active = false; clearInterval(timer); window.removeEventListener('focus', load); window.removeEventListener('site-settings-updated', load); };
  }, [enabled]);
  return settings;
}
export function PublicSiteNotice() {
  const settings = usePublicSiteSettings();
  if (!settings?.redemptionPaused) return null;
  return <section aria-label="站点公告" className="mx-auto mb-6 w-full max-w-3xl space-y-3">
    {settings.redemptionPaused && <Alert kind="warning" title="兑换已暂停">{settings.pauseReason || '暂时无法兑换，请稍后再试。'}</Alert>}

  </section>;
}
export function PublicDisclaimer() {
  const settings = usePublicSiteSettings();
  if (!settings?.disclaimer) return null;
  const parts = settings.disclaimer.split(/(https?:\/\/[^\s，。；、（）<>]+)/g);
  return <details className="mx-auto max-w-5xl px-4 pb-5 text-xs leading-6 text-muted-foreground sm:px-6"><summary className="cursor-pointer font-medium hover:text-foreground">关于本站与服务声明</summary><p className="mt-3 whitespace-pre-wrap break-words">{parts.map((part, i) => /^https?:\/\//.test(part) ? <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">{part}</a> : part)}</p></details>;
}
