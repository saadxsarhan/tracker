import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession, login, type Role } from '@/lib/auth';

const Schema = z.object({ email: z.string().email(), password: z.string().min(1) });

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  const user = await login(parsed.data.email, parsed.data.password);
  if (!user) return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
  const session = await getSession();
  session.userId = user.id;
  session.email = user.email;
  session.name = user.name;
  session.role = user.role as Role;
  await session.save();
  return NextResponse.json({ ok: true });
}
