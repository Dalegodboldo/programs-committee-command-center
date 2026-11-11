'use client';

import { createContext, useContext } from 'react';
import type { Profile } from '@/lib/types';

const Ctx = createContext<Profile | null>(null);

export function RoleProvider({ profile, children }: { profile: Profile; children: React.ReactNode }) {
  return <Ctx.Provider value={profile}>{children}</Ctx.Provider>;
}

export function useProfile() {
  const p = useContext(Ctx);
  if (!p) throw new Error('useProfile must be used inside RoleProvider');
  return p;
}

export function useCan() {
  const { role } = useProfile();
  return {
    role,
    isAdmin: role === 'admin',
    canEdit: role === 'admin' || role === 'member',
  };
}
