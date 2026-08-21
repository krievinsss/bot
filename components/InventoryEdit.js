'use client';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
export default function InventoryEdit({id,quantity,active}){
  const [q,setQ]=useState(quantity),[busy,setBusy]=useState(false),[err,setErr]=useState('');
  const router=useRouter();
  async function save(data){
    if(busy)return; setBusy(true);setErr('');
    try{const res=await fetch('/api/admin/data/inventory',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({id,...data})});const j=await res.json().catch(()=>({}));if(!res.ok)throw new Error(j.error||`Save failed (${res.status})`);router.refresh();}
    catch(e){setErr(e?.message||'Save failed');}finally{setBusy(false);}
  }
  return <div><div className="flex gap-2 items-center"><input className="input w-24" type="number" min="0" value={q} onChange={e=>setQ(e.target.value)}/><button type="button" disabled={busy} className="btn secondary" onClick={()=>save({quantity:Number(q)})}>{busy?'Saving…':'Save'}</button><button type="button" disabled={busy} className="btn secondary" onClick={()=>save({active:!active})}>{active?'Disable':'Enable'}</button></div>{err&&<div className="text-red-300 text-xs mt-1">{err}</div>}</div>;
}
