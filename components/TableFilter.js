'use client';
import {useEffect,useState} from 'react';
export default function TableFilter({tableId,placeholder='Search table…',statuses=[]}){
 const [q,setQ]=useState(''),[status,setStatus]=useState('');
 useEffect(()=>{const table=document.getElementById(tableId);if(!table)return;for(const row of table.querySelectorAll('tbody tr')){const text=(row.innerText||'').toLowerCase();const s=(row.dataset.status||'').toLowerCase();row.style.display=(!q||text.includes(q.toLowerCase()))&&(!status||s===status.toLowerCase())?'':'none';}},[q,status,tableId]);
 return <div className="flex flex-wrap gap-2 mb-3"><input className="input max-w-sm" value={q} onChange={e=>setQ(e.target.value)} placeholder={placeholder}/>{statuses.length>0&&<select className="input max-w-48" value={status} onChange={e=>setStatus(e.target.value)}><option value="">All statuses</option>{statuses.map(s=><option key={s} value={s}>{s}</option>)}</select>}{(q||status)&&<button type="button" className="btn secondary" onClick={()=>{setQ('');setStatus('')}}>Clear</button>}</div>;
}
