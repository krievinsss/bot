'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function ToggleButton({resource,id,field,value,label}){
  const router=useRouter();
  const [busy,setBusy]=useState(false);
  const [err,setErr]=useState('');
  async function run(){
    if(busy) return;
    setBusy(true); setErr('');
    try{
      const res=await fetch(`/api/admin/data/${resource}`,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({id,[field]:value})});
      const data=await res.json().catch(()=>({}));
      if(!res.ok) throw new Error(data.error||`Update failed (${res.status})`);
      router.refresh();
    }catch(e){setErr(e?.message||'Update failed');}
    finally{setBusy(false);}
  }
  return <div><button type="button" className="btn secondary" disabled={busy} onClick={run}>{busy?'Saving…':label}</button>{err&&<div className="text-red-300 text-xs mt-1">{err}</div>}</div>;
}
