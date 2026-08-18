'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminSetup({ configured, adminExists }) {
  const router = useRouter();
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  async function initialize() {
    setBusy(true);
    setStatus('');

    try {
      const res = await fetch('/api/admin/setup', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        setStatus(adminExists ? 'Administrator credentials synchronized. Opening sign in…' : 'Administrator created. Opening sign in…');
        setTimeout(() => {
          router.replace('/admin/login');
          router.refresh();
        }, 350);
        return;
      }

      setStatus(data.error || 'Setup failed. Check the Vercel environment variables and redeploy.');
    } catch {
      setStatus('Setup request failed. Try again after redeploying the project.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card w-full max-w-lg space-y-5">
      <div>
        <div className="badge mb-3">Admin setup</div>
        <h1 className="text-2xl font-bold">{adminExists ? 'Recover administrator access' : 'Create the first administrator'}</h1>
        <p className="muted mt-2">
          {adminExists
            ? 'An administrator already exists. You can safely synchronize that account with the credentials currently stored in Vercel.'
            : 'The first OWNER account will be created from the secure Vercel environment variables.'}
          {' '}Secret values are never sent to the browser.
        </p>
      </div>

      <div className="space-y-2 rounded-xl border border-slate-700 p-4">
        <div className="flex items-center justify-between gap-4">
          <span>SEED_ADMIN_EMAIL</span>
          <span className="badge">{configured.email ? 'configured' : 'missing'}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span>SEED_ADMIN_PASSWORD</span>
          <span className="badge">{configured.password ? 'configured' : 'missing / too short'}</span>
        </div>
      </div>

      {!configured.ready && (
        <p className="text-amber-300">
          Add the missing variable(s) in Vercel → Settings → Environment Variables, then redeploy. The password must be at least 12 characters.
        </p>
      )}

      <button className="btn w-full" type="button" onClick={initialize} disabled={!configured.ready || busy}>
        {busy ? 'Applying credentials…' : adminExists ? 'Synchronize administrator credentials' : 'Initialize administrator'}
      </button>

      {status && <p className="text-sm">{status}</p>}
      {adminExists && (
        <p className="muted text-xs">
          Recovery never accepts an email or password from the browser; only the server-side Vercel values are used.
        </p>
      )}
    </div>
  );
}
