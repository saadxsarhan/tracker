'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function DashboardForm({ dashboard, users, canEdit }: any) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ ...dashboard });
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof typeof form>(k: K, v: any) { setForm({ ...form, [k]: v }); }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    const r = await fetch(`/api/dashboards/${dashboard.id}`, {
      method: 'PUT',
      body: JSON.stringify(form),
      headers: { 'content-type': 'application/json' }
    });
    setBusy(false);
    if (!r.ok) {
      const b = await r.json().catch(() => ({}));
      setError(b.error ?? 'Save failed');
      return;
    }
    router.refresh();
  }

  const Field = ({ label, k, type = 'text' }: any) => (
    <div>
      <label className="label">{label}</label>
      <input
        className="input"
        type={type}
        value={form[k] ?? ''}
        onChange={e => set(k, e.target.value)}
        disabled={!canEdit}
      />
    </div>
  );

  const Select = ({ label, k, options }: any) => (
    <div>
      <label className="label">{label}</label>
      <select className="input" value={form[k] ?? ''} onChange={e => set(k, e.target.value)} disabled={!canEdit}>
        <option value="">—</option>
        {options.map((o: string) => <option key={o}>{o}</option>)}
      </select>
    </div>
  );

  return (
    <form onSubmit={save} className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Field label="Name" k="name" />
      <Select label="Domain" k="domain" options={['Finance', 'Procurement', 'HCM', 'IT SM', 'Strategy', 'Operations', 'Compliance', 'TBD']} />
      <Select label="Status" k="status" options={['Live', 'In Build', 'In Scoping', 'Not Started', 'Retired']} />
      <Select label="Tier" k="tier" options={['P1', 'P2', 'P3']} />
      <div>
        <label className="label">DE Owner</label>
        <select className="input" value={form.deOwnerId ?? ''} onChange={e => set('deOwnerId', e.target.value || null)} disabled={!canEdit}>
          <option value="">—</option>
          {users.map((u: any) => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
        </select>
      </div>
      <div>
        <label className="label">BI Owner</label>
        <select className="input" value={form.biOwnerId ?? ''} onChange={e => set('biOwnerId', e.target.value || null)} disabled={!canEdit}>
          <option value="">—</option>
          {users.map((u: any) => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
        </select>
      </div>
      <Field label="Source System" k="sourceSystem" />
      <Select label="Refresh Frequency" k="refreshFrequency" options={['Real-time', 'Hourly', 'Daily', 'Weekly', 'Monthly', 'Quarterly']} />
      <Field label="Refresh Window" k="refreshWindow" />
      <Field label="Business Sponsor" k="businessSponsor" />
      <Field label="Data Owner" k="dataOwner" />
      <Field label="Change Approver" k="changeApprover" />
      <Field label="Escalation Contact" k="escalationContact" />
      <Field label="Stakeholder Group" k="stakeholderGroup" />
      <Select label="Data Sensitivity" k="dataSensitivity" options={['Public', 'Internal', 'Confidential', 'Restricted']} />
      <div className="md:col-span-2">
        <label className="label">Access Rule</label>
        <textarea className="input" rows={2} value={form.accessRule ?? ''} onChange={e => set('accessRule', e.target.value)} disabled={!canEdit} />
      </div>
      <div className="md:col-span-2">
        <label className="label">Change Control Rule</label>
        <textarea className="input" rows={2} value={form.changeControlRule ?? ''} onChange={e => set('changeControlRule', e.target.value)} disabled={!canEdit} />
      </div>
      <div className="md:col-span-2">
        <label className="label">Notes</label>
        <textarea className="input" rows={3} value={form.notes ?? ''} onChange={e => set('notes', e.target.value)} disabled={!canEdit} />
      </div>
      {error && <div className="md:col-span-2 text-sm text-red-600">{error}</div>}
      {canEdit && (
        <div className="md:col-span-2 flex justify-end gap-2">
          <button type="submit" disabled={busy} className="btn-primary">{busy ? 'Saving…' : 'Save'}</button>
        </div>
      )}
      {!canEdit && <div className="md:col-span-2 text-xs text-slate-500 italic">Read-only — Admin permission required to edit governance.</div>}
    </form>
  );
}
