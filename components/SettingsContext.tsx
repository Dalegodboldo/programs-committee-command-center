'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { cssVars, normalize, type Settings } from '@/lib/settings';

const Ctx = createContext<{ settings: Settings; reload: () => Promise<void> } | null>(null);

// Holds the app's design settings and applies them live: when an admin saves a change, everyone's screen updates.
export function SettingsProvider({ initial, children }: { initial: Settings; children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(initial);

  async function reload() {
    const { data } = await supabaseBrowser().from('app_settings').select('settings').eq('id', 'site').maybeSingle();
    if (data) setSettings(normalize(data.settings));
  }

  useEffect(() => {
    const supabase = supabaseBrowser();
    const channel = supabase
      .channel(`settings-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_settings' }, (payload: any) => {
        if (payload.new?.settings) setSettings(normalize(payload.new.settings));
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    for (const [k, v] of Object.entries(cssVars(settings))) root.style.setProperty(k, v);
  }, [settings]);

  return <Ctx.Provider value={{ settings, reload }}>{children}</Ctx.Provider>;
}

export function useSettings() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSettings must be used inside SettingsProvider');
  return v;
}
