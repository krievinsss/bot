import Link from 'next/link';
import { prisma } from '../../../../lib/db.js';
import ToggleButton from '../../../../components/ToggleButton.js';

export default async function Page(){
  const rows=await prisma.order.findMany({include:{user:true,location:{include:{city:true}}},orderBy:{createdAt:'desc'},take:200});
  return <>
    <div className="mb-6"><h1 className="text-3xl font-bold">Orders</h1><p className="muted mt-1">Review the customer, assigned pickup location, payment amount and order status.</p></div>
    <div className="card overflow-x-auto"><table className="table"><thead><tr><th>ID</th><th>User</th><th>Product</th><th>Location</th><th>Paid</th><th>Status</th><th>Created</th><th></th></tr></thead><tbody>{rows.map(x=><tr key={x.id}>
      <td>{x.publicOrderId}</td><td>@{x.user.username||x.user.telegramId.toString()}</td><td>{x.productNameSnapshot}</td><td>{x.location.publicName||x.location.name}<div className="muted text-xs">{x.location.city.name}</div></td><td>€{Number(x.price).toFixed(2)}</td><td><span className="badge">{x.status}</span></td><td className="whitespace-nowrap">{new Intl.DateTimeFormat('en-GB',{dateStyle:'short',timeStyle:'short',timeZone:'Europe/Riga'}).format(x.createdAt)}</td><td><div className="flex gap-2"><Link className="btn secondary" href={`/admin/orders/${x.id}`}>Details</Link>{x.status==='PAID'&&<ToggleButton resource="orders" id={x.id} field="status" value="COMPLETED" label="Complete"/>}</div></td>
    </tr>)}</tbody></table></div>
  </>;
}
