import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { secretKey } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

// Admins: which pieces of the weekly email setup are in place (never returns the values).
export async function GET() {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({}, { status: 401 });
  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (me?.role !== 'admin') return NextResponse.json({}, { status: 403 });
  return NextResponse.json({
    resend: !!(process.env.RESEND_API_KEY ?? '').trim(),
    domain: !!(process.env.NOTIFY_FROM ?? '').trim(),
    secretKey: !!secretKey(),
    cronSecret: !!(process.env.CRON_SECRET ?? '').trim(),
  });
}
