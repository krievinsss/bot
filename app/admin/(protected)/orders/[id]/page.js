import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '../../../../../lib/db.js';
import { decrypt } from '../../../../../lib/encryption.js';
import ToggleButton from '../../../../../components/ToggleButton.js';

function safeDecrypt(value){try{return decrypt(value)||'—';}catch{return 'Unable to decrypt';}}
function fmtDate(value){return new Intl.DateTimeFormat('en-GB',{dateStyle:'medium',timeStyle:'medium',timeZone:'Europe/Riga'}).format(value);}

export default async function Page({params}){
  const {id}=await params;
  const order=await prisma.order.findUnique({where:{id},include:{user:true,product:true,location:{include:{city:true}}}});
  if(!order) notFound();
  const walletTx=await prisma.walletTransaction.findMany({where:{referenceId:order.publicOrderId},include:{user:true},orderBy:{createdAt:'asc'}});
  const image=order.location.privateImagePath?`/api/admin/media?path=${encodeURIComponent(order.location.privateImagePath)}`:null;
  const rows=[
    ['Order ID',order.publicOrderId],['Status',order.status],['Created',fmtDate(order.createdAt)],['Updated',fmtDate(order.updatedAt)],
    ['Customer',`@${order.user.username||order.user.telegramId.toString()}`],['Telegram ID',order.user.telegramId.toString()],
    ['Product',order.productNameSnapshot],['Current product name',order.product.name],['Paid',`€${Number(order.price).toFixed(2)}`],['City',order.cityNameSnapshot],
    ['Location',order.location.name],['Public location name',order.location.publicName||'—'],['Exact address',safeDecrypt(order.location.privateAddressEnc)],
    ['Latitude',safeDecrypt(order.location.latitudeEnc)],['Longitude',safeDecrypt(order.location.longitudeEnc)],['Pickup instructions',safeDecrypt(order.location.privateInstructionsEnc)]
  ];
  return <>
    <div className="flex items-center justify-between gap-4 mb-6"><div><Link href="/admin/orders" className="muted text-sm">← Back to orders</Link><h1 className="text-3xl font-bold mt-1">Order details</h1></div>{order.status==='PAID'&&<ToggleButton resource="orders" id={order.id} field="status" value="COMPLETED" label="Mark completed"/>}</div>
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="card"><h2 className="font-bold text-lg mb-4">Order information</h2><div className="grid gap-3">{rows.map(([k,v])=><div key={k} className="grid grid-cols-[160px_1fr] gap-3 border-b border-slate-800 pb-2"><div className="muted text-sm">{k}</div><div className="break-all">{v}</div></div>)}</div></div>
      <div className="grid gap-6 content-start">
        <div className="card"><h2 className="font-bold text-lg mb-4">Assigned pickup location</h2>{image?<img src={image} alt={order.location.name} className="w-full max-h-80 object-cover rounded-xl border border-slate-700"/>:<div className="muted">No location image</div>}<div className="mt-4 text-sm muted">This is the exact location assigned to this order.</div></div>
        <div className="card"><h2 className="font-bold text-lg mb-4">Wallet activity</h2>{walletTx.length?<div className="grid gap-2">{walletTx.map(tx=><div key={tx.id} className="flex justify-between gap-4 border-b border-slate-800 pb-2"><span>{tx.type} · @{tx.user.username||tx.user.telegramId.toString()}</span><span>{Number(tx.amount)>=0?'+':''}€{Number(tx.amount).toFixed(2)}</span></div>)}</div>:<div className="muted">No linked wallet transactions.</div>}</div>
      </div>
    </div>
  </>;
}
