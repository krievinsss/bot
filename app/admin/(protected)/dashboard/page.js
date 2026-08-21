import { prisma } from '../../../../lib/db.js';

export const dynamic='force-dynamic';

const money=v=>`€${Number(v||0).toFixed(2)}`;
const pct=v=>`${Number(v||0).toFixed(1)}%`;
const fmtDate=d=>new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Riga',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(d);
const dayKey=d=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Riga',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);

function StatCard({label,value,sub}){
  return <div className="card">
    <div className="muted text-sm">{label}</div>
    <div className="text-3xl font-bold mt-2">{value}</div>
    {sub&&<div className="muted text-xs mt-2">{sub}</div>}
  </div>;
}

export default async function Page(){
  const now=new Date();
  const h24=new Date(now.getTime()-24*60*60*1000);
  const d7=new Date(now.getTime()-7*24*60*60*1000);
  const d30=new Date(now.getTime()-30*24*60*60*1000);
  const paid={status:{in:['PAID','COMPLETED']}};

  const [
    usersTotal,users7,active24,ordersTotal,orders24,orders7,orders30,
    revenueTotal,revenue24,revenue7,revenue30,
    paymentsAll,paymentsCompleted,depositTotal,walletTotal,affiliateTotal,
    stockTotal,lowStock,outStock,activeProducts,activeCities,activeLocations,
    supportOpen,supportWaiting,topProductsRaw,topCitiesRaw,recentOrders,recentPayments,last7Orders
  ]=await Promise.all([
    prisma.user.count(),
    prisma.user.count({where:{createdAt:{gte:d7}}}),
    prisma.user.count({where:{lastActivity:{gte:h24}}}),
    prisma.order.count({where:paid}),
    prisma.order.count({where:{...paid,createdAt:{gte:h24}}}),
    prisma.order.count({where:{...paid,createdAt:{gte:d7}}}),
    prisma.order.count({where:{...paid,createdAt:{gte:d30}}}),
    prisma.order.aggregate({_sum:{price:true},where:paid}),
    prisma.order.aggregate({_sum:{price:true},where:{...paid,createdAt:{gte:h24}}}),
    prisma.order.aggregate({_sum:{price:true},where:{...paid,createdAt:{gte:d7}}}),
    prisma.order.aggregate({_sum:{price:true},where:{...paid,createdAt:{gte:d30}}}),
    prisma.payment.count(),
    prisma.payment.count({where:{status:'COMPLETED'}}),
    prisma.payment.aggregate({_sum:{amount:true},where:{status:'COMPLETED'}}),
    prisma.user.aggregate({_sum:{balance:true}}),
    prisma.user.aggregate({_sum:{lifetimeCommission:true}}),
    prisma.inventory.aggregate({_sum:{quantity:true},where:{active:true}}),
    prisma.inventory.count({where:{active:true,quantity:{gt:0,lte:3}}}),
    prisma.inventory.count({where:{active:true,quantity:0}}),
    prisma.product.count({where:{active:true}}),
    prisma.city.count({where:{active:true}}),
    prisma.location.count({where:{active:true}}),
    prisma.supportTicket.count({where:{status:'OPEN'}}),
    prisma.supportTicket.count({where:{status:'WAITING'}}),
    prisma.order.groupBy({by:['productId','productNameSnapshot'],where:paid,_sum:{price:true},_count:{_all:true},orderBy:{_count:{productId:'desc'}},take:5}),
    prisma.order.groupBy({by:['cityNameSnapshot'],where:paid,_sum:{price:true},_count:{_all:true},orderBy:{_count:{cityNameSnapshot:'desc'}},take:5}),
    prisma.order.findMany({where:paid,take:8,orderBy:{createdAt:'desc'},include:{user:true}}),
    prisma.payment.findMany({take:8,orderBy:{createdAt:'desc'},include:{user:true}}),
    prisma.order.findMany({where:{...paid,createdAt:{gte:d7}},select:{createdAt:true,price:true}})
  ]);

  const revenue=Number(revenueTotal._sum.price||0);
  const avgOrder=ordersTotal?revenue/ordersTotal:0;
  const paymentSuccess=paymentsAll?paymentsCompleted/paymentsAll*100:0;
  const units=stockTotal._sum.quantity||0;

  const dailyMap=new Map();
  for(let i=6;i>=0;i--){
    const d=new Date(now.getTime()-i*24*60*60*1000);
    dailyMap.set(dayKey(d),{orders:0,revenue:0});
  }
  for(const o of last7Orders){
    const k=dayKey(o.createdAt);
    if(dailyMap.has(k)){
      const x=dailyMap.get(k);
      x.orders++;
      x.revenue+=Number(o.price);
    }
  }
  const daily=[...dailyMap.entries()];
  const maxDaily=Math.max(1,...daily.map(([,x])=>x.revenue));

  return <>
    <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <div className="muted mt-1">Live business overview · Europe/Riga</div>
      </div>
      <div className="muted text-xs">Updated {fmtDate(now)}</div>
    </div>

    <h2 className="font-bold text-lg mb-3">Sales</h2>
    <div className="grid-cards mb-8">
      <StatCard label="Total revenue" value={money(revenue)} sub={`${ordersTotal} completed/paid orders`}/>
      <StatCard label="Revenue · 24h" value={money(revenue24._sum.price)} sub={`${orders24} orders`}/>
      <StatCard label="Revenue · 7 days" value={money(revenue7._sum.price)} sub={`${orders7} orders`}/>
      <StatCard label="Revenue · 30 days" value={money(revenue30._sum.price)} sub={`${orders30} orders`}/>
      <StatCard label="Average order" value={money(avgOrder)} sub="Average paid order value"/>
      <StatCard label="Payment success" value={pct(paymentSuccess)} sub={`${paymentsCompleted} of ${paymentsAll} deposits completed`}/>
    </div>

    <h2 className="font-bold text-lg mb-3">Customers & money</h2>
    <div className="grid-cards mb-8">
      <StatCard label="Users" value={usersTotal} sub={`+${users7} in last 7 days`}/>
      <StatCard label="Active users · 24h" value={active24} sub="Telegram activity"/>
      <StatCard label="Deposits received" value={money(depositTotal._sum.amount)} sub={`${paymentsCompleted} completed deposits`}/>
      <StatCard label="Wallet balances" value={money(walletTotal._sum.balance)} sub="Total customer balance liability"/>
      <StatCard label="Affiliate commission" value={money(affiliateTotal._sum.lifetimeCommission)} sub="Lifetime earned by referrers"/>
      <StatCard label="Open support" value={supportOpen} sub={`${supportWaiting} waiting`}/>
    </div>

    <h2 className="font-bold text-lg mb-3">Store health</h2>
    <div className="grid-cards mb-8">
      <StatCard label="Inventory units" value={units} sub="Across active inventory rows"/>
      <StatCard label="Low stock" value={lowStock} sub="1–3 units remaining"/>
      <StatCard label="Out of stock" value={outStock} sub="Active inventory rows at 0"/>
      <StatCard label="Active products" value={activeProducts}/>
      <StatCard label="Active cities" value={activeCities}/>
      <StatCard label="Active locations" value={activeLocations}/>
    </div>

    <div className="grid lg:grid-cols-2 gap-6 mb-8">
      <div className="card">
        <h2 className="font-bold mb-4">Last 7 days</h2>
        <div className="grid gap-3">
          {daily.map(([date,x])=><div key={date}>
            <div className="flex justify-between gap-3 text-sm mb-1">
              <span>{date}</span>
              <span className="muted">{x.orders} orders · {money(x.revenue)}</span>
            </div>
            <div className="h-2 rounded bg-slate-800 overflow-hidden">
              <div className="h-full bg-slate-400 rounded" style={{width:`${Math.max(x.revenue?4:0,x.revenue/maxDaily*100)}%`}}/>
            </div>
          </div>)}
        </div>
      </div>

      <div className="card">
        <h2 className="font-bold mb-3">Top products</h2>
        <table className="table">
          <thead><tr><th>Product</th><th>Orders</th><th>Revenue</th></tr></thead>
          <tbody>{topProductsRaw.map(x=><tr key={`${x.productId}-${x.productNameSnapshot}`}><td>{x.productNameSnapshot}</td><td>{x._count._all}</td><td>{money(x._sum.price)}</td></tr>)}</tbody>
        </table>
        {!topProductsRaw.length&&<div className="muted text-sm">No sales yet.</div>}
      </div>
    </div>

    <div className="grid lg:grid-cols-2 gap-6 mb-8">
      <div className="card">
        <h2 className="font-bold mb-3">Top cities</h2>
        <table className="table">
          <thead><tr><th>City</th><th>Orders</th><th>Revenue</th></tr></thead>
          <tbody>{topCitiesRaw.map(x=><tr key={x.cityNameSnapshot}><td>{x.cityNameSnapshot}</td><td>{x._count._all}</td><td>{money(x._sum.price)}</td></tr>)}</tbody>
        </table>
        {!topCitiesRaw.length&&<div className="muted text-sm">No city sales yet.</div>}
      </div>

      <div className="card">
        <h2 className="font-bold mb-3">Recent deposits</h2>
        <table className="table">
          <thead><tr><th>User</th><th>Amount</th><th>Status</th><th>Time</th></tr></thead>
          <tbody>{recentPayments.map(p=><tr key={p.id}><td>@{p.user.username||p.user.firstName||'—'}</td><td>{money(p.amount)}</td><td><span className="badge">{p.status}</span></td><td className="muted text-xs">{fmtDate(p.createdAt)}</td></tr>)}</tbody>
        </table>
        {!recentPayments.length&&<div className="muted text-sm">No deposits yet.</div>}
      </div>
    </div>

    <div className="card overflow-x-auto">
      <h2 className="font-bold mb-3">Recent orders</h2>
      <table className="table">
        <thead><tr><th>Order</th><th>User</th><th>Product</th><th>City</th><th>Amount</th><th>Status</th><th>Time</th></tr></thead>
        <tbody>{recentOrders.map(o=><tr key={o.id}><td>{o.publicOrderId}</td><td>@{o.user.username||o.user.firstName||'—'}</td><td>{o.productNameSnapshot}</td><td>{o.cityNameSnapshot}</td><td>{money(o.price)}</td><td><span className="badge">{o.status}</span></td><td className="muted text-xs">{fmtDate(o.createdAt)}</td></tr>)}</tbody>
      </table>
      {!recentOrders.length&&<div className="muted text-sm">No orders yet.</div>}
    </div>
  </>;
}
