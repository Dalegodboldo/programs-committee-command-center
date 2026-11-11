import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import { RoleProvider } from '@/components/RoleContext';
import Nav from '@/components/Nav';
import RequestAgain from '@/components/RequestAgain';
import AskClaude from '@/components/AskClaude';
import type { Profile } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data } = await supabase.from('profiles').select('id, email, full_name, role, declined').eq('id', user.id).single();
  const profile: Profile = data
    ? { id: data.id, email: data.email, full_name: data.full_name, role: data.role }
    : { id: user.id, email: user.email ?? null, full_name: null, role: null };
  const declined = Boolean(data?.declined);

  if (!profile.role) {
    return (
      <main className="flex min-h-screen items-center justify-center p-4">
        <div className="card max-w-md space-y-3 text-center">
          <img src="/aitcf-seal.png" alt="" className="mx-auto h-12 w-12" />
          {declined ? (
            <>
              <h1 className="font-semibold">Your access request was declined.</h1>
              <p className="text-sm text-slate-500">If you think that's a mistake, you can ask an admin to look again. Signed in as {profile.email}.</p>
              <RequestAgain />
            </>
          ) : (
            <>
              <h1 className="font-semibold">Your access request is with the admins.</h1>
              <p className="text-sm text-slate-500">You'll be able to see the dashboard once an admin approves it. Signed in as {profile.email}.</p>
            </>
          )}
          <form action="/auth/signout" method="post">
            <button className="btn-ghost">Sign out</button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <RoleProvider profile={profile}>
      <div className="min-h-screen md:flex">
        <Nav />
        <main className="min-w-0 flex-1 p-4 pb-24 md:p-8 md:pb-8 print:p-0">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>
      <AskClaude />
    </RoleProvider>
  );
}
