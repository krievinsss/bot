'use client';
import { useEffect, useState } from 'react';

export default function ImageUploadField({name,label,kind='product'}){
  const [value,setValue]=useState('');
  const [busy,setBusy]=useState(false);
  const [err,setErr]=useState('');
  const [preview,setPreview]=useState('');

  useEffect(()=>()=>{ if(preview?.startsWith('blob:')) URL.revokeObjectURL(preview); },[preview]);

  async function upload(e){
    const file=e.target.files?.[0];
    if(!file) return;
    if(preview?.startsWith('blob:')) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(file));
    setBusy(true);
    setErr('');

    const fd=new FormData();
    fd.set('file',file);
    fd.set('kind',kind==='private'?'private':'product');

    try{
      const r=await fetch('/api/uploads',{method:'POST',body:fd});
      const j=await r.json().catch(()=>({}));
      if(!r.ok) throw new Error(j.error||'Upload failed');
      setValue(kind==='private'?(j.pathname||''):(j.url||''));
    }catch(e){
      setValue('');
      setErr(e.message||'Upload failed');
    }finally{
      setBusy(false);
    }
  }

  return <div>
    <label className="muted text-sm">{label}</label>
    <input className="input mt-1" type="file" accept="image/png,image/jpeg,image/webp" onChange={upload}/>
    <input type="hidden" name={name} value={value}/>
    {preview&&<img src={preview} alt="Preview" className="mt-2 h-24 w-24 rounded-lg object-cover border border-slate-700"/>}
    {busy&&<div className="muted text-xs mt-1">Uploading…</div>}
    {value&&!busy&&<div className="text-emerald-300 text-xs mt-1">Uploaded ✓</div>}
    {err&&<div className="text-red-300 text-xs mt-1">{err}</div>}
  </div>
}
