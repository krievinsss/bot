'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminLogin() {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);

    try {
      const f = new FormData(e.currentTarget);
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: f.get('email'), password: f.get('password') }),
      });

      if (res.ok) {
        router.replace('/admin/dashboard');
        router.refresh();
        return;
      }

      if (res.status === 429) {
        setError('Too many sign-in attempts. Wait about 15 minutes and try again.');
      } else {
        setError('Invalid email or password.');
      }
    } catch {
      setError('Sign-in request failed. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card w-full max-w-md space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Admin sign in</h1>
        <p className="muted">Private operations console</p>
      </div>
      <input className="input" name="email" type="email" autoComplete="username" placeholder="Email" required />
      <input className="input" name="password" type="password" autoComplete="current-password" placeholder="Password" required />
      <button className="btn w-full" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      {error && <p className="text-red-300">{error}</p>}
    </form>
  );
}
