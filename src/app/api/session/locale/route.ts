import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

export async function POST(req: Request) {
  const { locale } = await req.json();
  if (locale !== 'en' && locale !== 'ar') return NextResponse.json({ error: 'Bad locale' }, { status: 400 });
  const s = await getSession();
  s.locale = locale;
  await s.save();
  return NextResponse.json({ ok: true });
}
