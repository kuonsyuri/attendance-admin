import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  // パスワード認証
  const body = await req.json().catch(() => ({ password: '', staffIds: [] as number[] }));
  if (body.password !== process.env.NEXT_PUBLIC_APP_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const staffIds: number[] = Array.isArray(body.staffIds) ? body.staffIds : [];
  if (staffIds.length === 0) {
    return NextResponse.json({ error: 'staffIds is required' }, { status: 400 });
  }

  // service_role キーで RLS をバイパス
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const errors: string[] = [];

  for (const id of staffIds) {
    // FK 制約順: attendance_logs → staff_stores → staff
    const r1 = await supabase.from('attendance_logs').delete().eq('staff_id', id);
    if (r1.error) {
      errors.push(`attendance_logs(id=${id}): ${r1.error.message}`);
      continue;
    }
    const r2 = await supabase.from('staff_stores').delete().eq('staff_id', id);
    if (r2.error) {
      errors.push(`staff_stores(id=${id}): ${r2.error.message}`);
      continue;
    }
    const r3 = await supabase.from('staff').delete().eq('id', id);
    if (r3.error) {
      errors.push(`staff(id=${id}): ${r3.error.message}`);
    }
  }

  if (errors.length > 0) {
    return NextResponse.json({ ok: false, errors }, { status: 500 });
  }

  return NextResponse.json({ ok: true, deleted: staffIds.length });
}
