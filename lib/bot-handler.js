import { prisma } from './db.js';
import { tg,mainKeyboard,inline,esc } from './telegram.js';
import { purchase } from './purchase.js';
import { publicId } from './ids.js';
import { createPayPalOrder } from './paypal.js';
import { get } from '@vercel/blob';

async function upsertUser(from,startParam){
  let parentId=null;
  if(startParam?.startsWith('ref_')){ const tid=startParam.slice(4); if(/^\d+$/.test(tid) && tid!==String(from.id)){ const p=await prisma.user.findUnique({where:{telegramId:BigInt(tid)}}); parentId=p?.id||null; } }
  const existing=await prisma.user.findUnique({where:{telegramId:BigInt(from.id)}});
  if(existing) return prisma.user.update({where:{id:existing.id},data:{username:from.username||null,firstName:from.first_name||null,lastActivity:new Date()}});
  const user=await prisma.user.create({data:{telegramId:BigInt(from.id),username:from.username||null,firstName:from.first_name||null,referralParentId:parentId}});
  if(parentId) await prisma.user.update({where:{id:parentId},data:{referralCount:{increment:1}}}); return user;
}
async function shopping(chat){
  const rows=await prisma.city.findMany({where:{active:true,locations:{some:{active:true,inventory:{some:{active:true,quantity:{gt:0},product:{active:true}}}}}},orderBy:{name:'asc'}});
  if(!rows.length) return tg.sendMessage(chat,'No products are currently available.');
  return tg.sendMessage(chat,'<b>Choose your city:</b>',{reply_markup:inline(rows.map(c=>[{text:c.name,callback_data:`city:${c.id}`}]))});
}
async function cityProducts(chat,cityId){
  const city=await prisma.city.findUnique({where:{id:cityId}}); if(!city) return;
  const products=await prisma.product.findMany({where:{active:true,inventory:{some:{active:true,quantity:{gt:0},location:{active:true,cityId}}}},orderBy:{name:'asc'}});
  return tg.sendMessage(chat,`<b>Products in ${esc(city.name)}:</b>`,{reply_markup:inline(products.map(p=>[{text:`${p.name} — €${Number(p.price).toFixed(2)}`,callback_data:`product:${cityId}:${p.id}`}]).concat([[{text:'◀ Back',callback_data:'shopping'}]]))});
}
async function productDetail(chat,cityId,productId){
  const p=await prisma.product.findUnique({where:{id:productId}}); const c=await prisma.city.findUnique({where:{id:cityId}}); if(!p||!c) return;
  const available=await prisma.inventory.aggregate({_sum:{quantity:true},where:{productId,active:true,quantity:{gt:0},location:{active:true,cityId}}});
  const caption=`<b>${esc(p.name)}</b>\n\n💰 Price: €${Number(p.price).toFixed(2)}\n🏙 City: ${esc(c.name)}\n📦 Available: ${available._sum.quantity||0}\n\n${esc(p.description)}`;
  const extra={reply_markup:inline([[{text:'Buy',callback_data:`buy:${cityId}:${p.id}`}],[{text:'◀ Back',callback_data:`city:${cityId}`}]] )};
  return p.imageUrl?tg.sendPhoto(chat,p.imageUrl,caption,extra):tg.sendMessage(chat,caption,extra);
}
async function addFunds(chat,user){
  const buttons=[10,25,50,100].map(x=>[{text:`€${x}`,callback_data:`fund:${x}`}]);
  return tg.sendMessage(chat,`Current balance: €${Number(user.balance).toFixed(2)}\n\nChoose amount:`,{reply_markup:inline([...buttons,[{text:'Custom amount',callback_data:'fundcustom'}]])});
}
async function fund(chat,user,amount){
  if(amount<5||amount>1000) return tg.sendMessage(chat,'Amount must be between €5 and €1000.');
  const payment=await prisma.payment.create({data:{publicId:publicId('PAY'),userId:user.id,amount,currency:'EUR'}}); const order=await createPayPalOrder(payment); const approve=order.links?.find(x=>x.rel==='payer-action'||x.rel==='approve')?.href;
  await prisma.payment.update({where:{id:payment.id},data:{providerOrderId:order.id}});
  return tg.sendMessage(chat,`Add €${amount.toFixed(2)} to your wallet:`,{reply_markup:inline([[{text:'Pay with PayPal / Card',url:approve}]])});
}
async function account(chat,user){
  const [completed,active]=await Promise.all([prisma.order.count({where:{userId:user.id,status:{in:['PAID','COMPLETED']}}}),prisma.order.count({where:{userId:user.id,status:'PAID'}})]);
  return tg.sendMessage(chat,`<b>Account</b>\n\n👤 @${esc(user.username||'—')}\n💵 Balance: €${Number(user.balance).toFixed(2)}\n📦 Completed orders: ${completed}\n🟢 Active orders: ${active}\n🤝 Referrals: ${user.referralCount}\n💰 Lifetime commission: €${Number(user.lifetimeCommission).toFixed(2)}\n🔔 Notifications: ${user.notificationEnabled?'On':'Off'}\n✅ Status: ${user.accountStatus}`,{reply_markup:inline([[{text:'Order History',callback_data:'history'}],[{text:'Affiliate',callback_data:'affiliate'}],[{text:'Notifications',callback_data:'notifications'}]])});
}
export async function handleTelegram(update){
  const msg=update.message; const cb=update.callback_query; const from=msg?.from||cb?.from; if(!from) return;
  const chat=msg?.chat?.id||cb?.message?.chat?.id; const text=msg?.text||''; const startParam=text.startsWith('/start ')?text.slice(7).trim():null; const user=await upsertUser(from,startParam);
  if(msg){
    if(text.startsWith('/start')) return tg.sendMessage(chat,'Welcome! Choose an option:',{reply_markup:mainKeyboard()});
    if(text==='🛍 Shopping') return shopping(chat);
    if(text==='💵 Add Funds') return addFunds(chat,user);
    if(text==='👤 Account') return account(chat,user);
    if(text==='☎️ Support') return tg.sendMessage(chat,'Send your support message as:\n<code>/support your message</code>');
    if(user.pendingAction==='CUSTOM_FUND'){ const amount=Number(text.replace(',','.')); if(Number.isFinite(amount)&&amount>=5&&amount<=1000){ await prisma.user.update({where:{id:user.id},data:{pendingAction:null}}); return fund(chat,user,amount); } return tg.sendMessage(chat,'Enter an amount between €5 and €1000, for example <code>35</code>.'); }
    if(text.startsWith('/support ')){ const body=text.slice(9).trim(); if(!body) return; const ticket=await prisma.supportTicket.create({data:{publicId:publicId('TKT'),userId:user.id,messages:{create:{sender:'USER',message:body}}}}); return tg.sendMessage(chat,`Support ticket ${ticket.publicId} created.`); }
    return;
  }
  if(cb){
    await tg.answerCallback(cb.id).catch(()=>{}); const d=cb.data||'';
    if(d==='shopping') return shopping(chat);
    if(d.startsWith('city:')) return cityProducts(chat,d.split(':')[1]);
    if(d.startsWith('product:')){ const [,cityId,productId]=d.split(':'); return productDetail(chat,cityId,productId); }
    if(d.startsWith('buy:')){ const [,cityId,productId]=d.split(':'); try{ const o=await purchase({telegramId:from.id,productId,cityId,idempotencyKey:`tg:${cb.id}`}); const text=`✅ <b>Payment confirmed</b>\n\n🛍 Product: ${esc(o.productNameSnapshot)}\n💰 Paid: €${Number(o.price).toFixed(2)}\n🏙 City: ${esc(o.cityNameSnapshot)}\n💵 Balance left: €${Number(o.balanceAfter).toFixed(2)}\n\n📍 Pickup location:\n${esc(o.address)}\n\n🧭 Coordinates:\n${esc(o.latitude)}, ${esc(o.longitude)}\n\n📝 Pickup instructions:\n${esc(o.instructions)}\n\nOrder ID: ${o.publicOrderId}`; await tg.sendMessage(chat,text); await tg.sendLocation(chat,o.latitude,o.longitude).catch(()=>{}); if(o.location.privateImagePath){ try{ const blob=await get(o.location.privateImagePath,{access:'private'}); if(blob?.stream){ const bytes=Buffer.from(await new Response(blob.stream).arrayBuffer()); await tg.sendPhotoBytes(chat,bytes,'pickup-location.jpg','Pickup location image'); } }catch{} } return; }catch(e){ const map={INSUFFICIENT_FUNDS:'Insufficient wallet balance.',OUT_OF_STOCK:'This product is sold out.',PRODUCT_UNAVAILABLE:'Product unavailable.',ACCOUNT_UNAVAILABLE:'Account unavailable.'}; return tg.sendMessage(chat,map[e.message]||'Purchase failed. Please try again.'); } }
    if(d.startsWith('fund:')) return fund(chat,user,Number(d.split(':')[1]));
    if(d==='fundcustom'){ await prisma.user.update({where:{id:user.id},data:{pendingAction:'CUSTOM_FUND'}}); return tg.sendMessage(chat,'Enter the amount you want to add (€5–€1000):'); }
    if(d==='history'){ const orders=await prisma.order.findMany({where:{userId:user.id},orderBy:{createdAt:'desc'},take:10}); return tg.sendMessage(chat,orders.length?orders.map(o=>`${o.publicOrderId} — ${esc(o.productNameSnapshot)} — €${Number(o.price).toFixed(2)}`).join('\n'):'No orders yet.'); }
    if(d==='notifications'){ const updated=await prisma.user.update({where:{id:user.id},data:{notificationEnabled:!user.notificationEnabled}}); return tg.sendMessage(chat,`Notifications ${updated.notificationEnabled?'enabled':'disabled'}.`); }
    if(d==='affiliate'){ const link=`https://t.me/${process.env.BOT_USERNAME}?start=ref_${user.telegramId}`; return tg.sendMessage(chat,`Your referral link:\n${link}\n\nReferrals: ${user.referralCount}\nLifetime commission: €${Number(user.lifetimeCommission).toFixed(2)}`); }
  }
}
