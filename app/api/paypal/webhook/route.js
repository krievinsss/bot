import { prisma } from '../../../../lib/db.js';
import { verifyPayPalWebhook } from '../../../../lib/paypal.js';
import { audit } from '../../../../lib/audit.js';
export async function POST(req){
  try{
    const event=await req.json(); if(!(await verifyPayPalWebhook(req.headers,event))) return Response.json({error:'Request failed'},{status:401});
    const existing=await prisma.processedWebhook.findUnique({where:{provider_eventId:{provider:'PAYPAL',eventId:event.id}}}); if(existing) return Response.json({ok:true});
    await prisma.$transaction(async tx=>{
      await tx.processedWebhook.create({data:{provider:'PAYPAL',eventId:event.id,eventType:event.event_type}});
      if(event.event_type!=='PAYMENT.CAPTURE.COMPLETED') return;
      const res=event.resource; const captureId=res.id; const providerOrderId=res.supplementary_data?.related_ids?.order_id; const currency=res.amount?.currency_code; const amount=Number(res.amount?.value);
      const payment=await tx.payment.findFirst({where:{providerOrderId}}); if(!payment) throw new Error('PAYMENT_NOT_FOUND'); if(payment.status==='COMPLETED') return;
      if(currency!==payment.currency || Math.abs(amount-Number(payment.amount))>0.001) throw new Error('PAYMENT_MISMATCH');
      const user=await tx.user.findUnique({where:{id:payment.userId}}); const before=user.balance; const after=Number(before)+amount;
      await tx.user.update({where:{id:user.id},data:{balance:{increment:payment.amount}}});
      await tx.walletTransaction.create({data:{userId:user.id,type:'DEPOSIT',amount:payment.amount,balanceBefore:before,balanceAfter:after,referenceId:payment.publicId}});
      await tx.payment.update({where:{id:payment.id},data:{status:'COMPLETED',providerCaptureId:captureId}});
    });
    await audit('PAYMENT_RECEIVED',{actorType:'PAYPAL',targetType:'Payment',targetId:event.id}); return Response.json({ok:true});
  }catch(e){ console.error('paypal_webhook_error',e?.message); return Response.json({error:'Request failed'},{status:500}); }
}
