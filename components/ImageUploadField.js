'use client';
import { useState } from 'react';
export default function ImageUploadField({name,label,kind='product'}){
  const [value,setValue]=useState(''); const [busy,setBusy]=useState(false); const [err,setErr]=useState('');
  async function upload(e){ const file=e.target.files?.[0]; if(!file)return; setBusy(true);setErr(''); const fd=new FormData(); fd.set('file',file); fd.set('kind',kind==='private'?'private':'product'); const r=await fetch('/api/uploads',{method:'POST',body:fd}); const j=await r.json().catch(()=>({})); if(r.ok)setValue(kind==='private'?(j.pathname||''):(j.url||'')); else setErr(j.error||'Upload failed'); setBusy(false); }
  return <div><label className="muted text-sm">{label}</label><input className="input mt-1" type="file" accept="image/png,image/jpeg,image/webp" onChange={upload}/><input type="hidden" name={name} value={value}/>{busy&&<div className="muted text-xs mt-1">Uploading…</div>}{value&&<div className="muted text-xs mt-1">Uploaded ✓</div>}{err&&<div className="text-red-300 text-xs mt-1">{err}</div>}</div>
}
