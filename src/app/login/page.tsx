import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { LoginForm } from './LoginForm';

export default async function LoginPage() {
  const session = await getSession();
  if (session.userId) redirect('/overview');

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-navy to-navy-700 p-4">
      <div className="bg-white rounded-xl shadow-2xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-block w-12 h-12 rounded bg-gold mb-3 flex items-center justify-center">
            <span className="text-white font-bold text-xl">R</span>
          </div>
          <h1 className="text-2xl font-bold text-navy">Remat D&A KPI Tracker</h1>
          <p className="text-sm text-slate-500 mt-1">Sign in to continue</p>
        </div>
        <LoginForm />
        <div className="mt-6 pt-6 border-t border-slate-200 text-xs text-slate-500">
          <p className="font-semibold mb-1">Demo accounts (password: <code>demo1234</code>):</p>
          <ul className="space-y-0.5 font-mono">
            <li>saad@remat.sa — Admin</li>
            <li>yasir@remat.sa — Data Engineer</li>
            <li>ahmad@remat.sa — BI Developer</li>
            <li>cfo@remat.sa — Stakeholder</li>
            <li>ceo@remat.sa — Executive</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
