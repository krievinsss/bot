'use client';

function money(v){return `€${Number(v||0).toFixed(2)}`}

export function RevenueChart({data=[]}){
  const w=760,h=240,p=28;
  const max=Math.max(1,...data.map(x=>x.revenue));
  const pts=data.map((x,i)=>{const px=p+(i*(w-2*p))/Math.max(1,data.length-1);const py=h-p-(x.revenue/max)*(h-2*p);return [px,py]});
  const poly=pts.map(x=>x.join(',')).join(' ');
  return <div className="card"><div className="chart-head"><div><h2>Revenue trend</h2><p>Last 30 days</p></div><strong>{money(data.reduce((a,b)=>a+b.revenue,0))}</strong></div><div className="chart-wrap"><svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Revenue trend"><line x1={p} y1={h-p} x2={w-p} y2={h-p} stroke="#e5e5e5"/><line x1={p} y1={p} x2={p} y2={h-p} stroke="#eeeeee"/><polyline points={poly} fill="none" stroke="#171717" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"/>{pts.map((pt,i)=><circle key={i} cx={pt[0]} cy={pt[1]} r="2.5" fill="#171717"><title>{data[i].label}: {money(data[i].revenue)}</title></circle>)}</svg></div><div className="chart-axis"><span>{data[0]?.label||''}</span><span>{data[Math.floor(data.length/2)]?.label||''}</span><span>{data[data.length-1]?.label||''}</span></div></div>
}

export function OrdersChart({data=[]}){
  const max=Math.max(1,...data.map(x=>x.orders));
  return <div className="card"><div className="chart-head"><div><h2>Orders</h2><p>Daily order volume · 30 days</p></div><strong>{data.reduce((a,b)=>a+b.orders,0)}</strong></div><div className="bars-chart">{data.map((x,i)=><div key={i} className="bar-col" title={`${x.label}: ${x.orders} orders`}><div className="bar-fill" style={{height:`${Math.max(x.orders?5:1,(x.orders/max)*100)}%`}}/></div>)}</div><div className="chart-axis"><span>{data[0]?.label||''}</span><span>{data[Math.floor(data.length/2)]?.label||''}</span><span>{data[data.length-1]?.label||''}</span></div></div>
}

export function RankedBars({title,subtitle,data=[],valueKey='orders',format=v=>String(v)}){
  const max=Math.max(1,...data.map(x=>Number(x[valueKey]||0)));
  return <div className="card"><div className="chart-head"><div><h2>{title}</h2><p>{subtitle}</p></div></div><div className="rank-bars">{data.length?data.map((x,i)=><div key={i} className="rank-row"><div className="rank-label"><span>{x.label}</span><strong>{format(x[valueKey])}</strong></div><div className="rank-track"><div className="rank-fill" style={{width:`${(Number(x[valueKey]||0)/max)*100}%`}}/></div></div>):<div className="muted text-sm">No data yet.</div>}</div></div>
}
