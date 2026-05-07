'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    const r = await fetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
      headers: { 'content-type': 'application/json' }
    });
    if (!r.ok) {
      const body = await r.json().catch(() => ({}));
      setError(body.error ?? 'Login failed');
      setBusy(false);
      return;
    }
    router.push('/overview');
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="label">Email</label>
        <input className="input" type="email" required value={email} onChange={e => setEmail(e.target.value)} />
      </div>
      <div>
        <label className="label">Password</label>
        <input className="input" type="password" required value={password} onChange={e => setPassword(e.target.value)} />
      </div>
      {error && <div className="text-sm text-red-600">{error}</div>}
      <button type="submit" disabled={busy} className="btn-primary w-full">
        {busy ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}
