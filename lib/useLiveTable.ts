'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabaseBrowser } from './supabase/client';
import type { Row } from './types';

type Options = { orderBy?: string; ascending?: boolean; limit?: number };

// Loads a table and keeps it in sync: any change by anyone appears here within a second.
export function useLiveTable<T extends Row = Row>(table: string, opts: Options = {}) {
  const { orderBy = 'created_at', ascending = true, limit } = opts;
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const supabase = supabaseBrowser();
    let q = supabase.from(table).select('*').order(orderBy, { ascending, nullsFirst: false });
    if (limit) q = q.limit(limit);
    const { data, error } = await q;
    if (error) setError(error.message);
    else setRows((data ?? []) as T[]);
    setLoading(false);
  }, [table, orderBy, ascending, limit]);

  useEffect(() => {
    load();
    const supabase = supabaseBrowser();
    const channel = supabase
      .channel(`live-${table}-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table }, (payload: any) => {
        setRows((prev) => {
          if (payload.eventType === 'DELETE') return prev.filter((r) => r.id !== payload.old.id);
          const incoming = payload.new as T;
          const exists = prev.some((r) => r.id === incoming.id);
          return exists ? prev.map((r) => (r.id === incoming.id ? incoming : r)) : [...prev, incoming];
        });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, load]);

  const update = useCallback(
    async (id: string, patch: Partial<T>) => {
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
      const { error } = await supabaseBrowser().from(table).update(patch).eq('id', id);
      if (error) {
        setError(error.message);
        load();
        return false;
      }
      return true;
    },
    [table, load],
  );

  const insert = useCallback(
    async (values: Partial<T>) => {
      const { data, error } = await supabaseBrowser().from(table).insert(values).select().single();
      if (error) setError(error.message);
      else if (data) setRows((prev) => (prev.some((r) => r.id === data.id) ? prev : [...prev, data as T]));
      return data as T | null;
    },
    [table],
  );

  const remove = useCallback(
    async (id: string) => {
      const { error } = await supabaseBrowser().from(table).delete().eq('id', id);
      if (error) setError(error.message);
      else setRows((prev) => prev.filter((r) => r.id !== id));
    },
    [table],
  );

  return { rows, loading, error, setError, update, insert, remove, reload: load };
}
