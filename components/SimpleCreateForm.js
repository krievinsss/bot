'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import ImageUploadField from './ImageUploadField.js';

export default function SimpleCreateForm({ resource, fields }) {
  const router = useRouter();
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [formKey, setFormKey] = useState(0);

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    const form = e.currentTarget;
    const fd = new FormData(form);
    const body = {};
    for (const f of fields) {
      if (f.type === 'checkbox') body[f.name] = fd.get(f.name) === 'on';
      else body[f.name] = fd.get(f.name) ?? '';
    }

    setBusy(true);
    setErr('');
    try {
      const res = await fetch(`/api/admin/data/${resource}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Save failed (${res.status})`);

      form.reset();
      setFormKey(k => k + 1);
      router.refresh();
    } catch (error) {
      setErr(error?.message || 'Could not save.');
    } finally {
      setBusy(false);
    }
  }

  return <form key={formKey} onSubmit={submit} className="card grid gap-3 mb-6">
    <h2 className="font-bold text-lg">Add {resource.slice(0, -1)}</h2>
    {fields.map(f => f.type === 'image'
      ? <ImageUploadField key={f.name} name={f.name} label={f.label} kind={f.kind}/>
      : f.type === 'select'
        ? <label key={f.name} className="grid gap-1"><span className="muted text-sm">{f.label || f.name}</span><select className="input" name={f.name} required={f.required} defaultValue=""><option value="" disabled>Select {f.label || f.name}</option>{f.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label>
        : f.type === 'textarea'
          ? <textarea key={f.name} className="input" name={f.name} placeholder={f.label} required={f.required}/>
          : f.type === 'checkbox'
            ? <label key={f.name} className="flex gap-2"><input name={f.name} type="checkbox" defaultChecked={f.defaultChecked !== false}/> {f.label}</label>
            : <input key={f.name} className="input" name={f.name} type={f.type || 'text'} step={f.step} min={f.min} placeholder={f.label} required={f.required}/>
    )}
    <button className="btn justify-self-start" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
    {err && <p className="text-red-300">{err}</p>}
  </form>;
}
