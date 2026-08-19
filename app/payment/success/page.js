import { prisma } from '../../../lib/db.js';
import { capturePayPalOrder } from '../../../lib/paypal.js';

async function settle(orderId){
  const order=await capturePayPalOrder(orderId);
  const capture=order?.purchase_units?.[0]?.payments?.captures?.[0];
  if(order?.status!=='COMPLETED' || !capture || capture.status!=='COMPLETED') throw new Error('Payment not completed');

  const payment=await prisma.payment.findFirst({where:{providerOrderId:orderId}});
  if(!payment) throw new Error('Payment record not found');
  if(payment.status==='COMPLETED') return {amount:Number(payment.amount),currency:payment.currency};

  const amount=Number(capture.amount?.value);
  const currency=capture.amount?.currency_code;
  if(currency!==payment.currency || !Number.isFinite(amount) || Math.abs(amount-Number(payment.amount))>0.001) throw new Error('Payment amount mismatch');

  await prisma.$transaction(async tx=>{
    const fresh=await tx.payment.findUnique({where:{id:payment.id}});
    if(!fresh || fresh.status==='COMPLETED') return;
    const user=await tx.user.findUnique({where:{id:fresh.userId}});
    if(!user) throw new Error('User not found');
    const before=user.balance;
    const after=Number(before)+Number(fresh.amount);
    await tx.user.update({where:{id:user.id},data:{balance:{increment:fresh.amount}}});
    await tx.walletTransaction.create({data:{userId:user.id,type:'DEPOSIT',amount:fresh.amount,balanceBefore:before,balanceAfter:after,referenceId:fresh.publicId}});
    await tx.payment.update({where:{id:fresh.id},data:{status:'COMPLETED',providerCaptureId:capture.id}});
  });

  return {amount,currency};
}

export default async function Page({searchParams}){
  const sp=await searchParams;
  const orderId=sp?.token;
  let ok=false, info=null, error='';
  try{
    if(!orderId) throw new Error('Missing payment token');
    info=await settle(orderId);
    ok=true;
  }catch(e){
    console.error('paypal_return_error',e?.message);
    error=e?.message||'Payment confirmation failed';
  }

  return <main className="min-h-screen grid place-items-center p-8"><div className="card max-w-lg">
    <h1 className="text-2xl font-bold">{ok?'Payment confirmed':'Payment pending'}</h1>
    {ok?<p className="muted mt-2">€{Number(info.amount).toFixed(2)} has been added to your wallet. You can return to Telegram.</p>:<p className="muted mt-2">We could not confirm the payment yet. Return to Telegram and try Account again shortly. Reference: {error}</p>}
  </div></main>;
}
