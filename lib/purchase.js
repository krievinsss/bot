import { Prisma } from '@prisma/client';
import { prisma } from './db.js';
import { decrypt } from './encryption.js';
import { publicId } from './ids.js';
export async function purchase({telegramId,productId,cityId,idempotencyKey}){
  for(let attempt=0;attempt<3;attempt++){
    try{
      return await prisma.$transaction(async tx=>{
        const existing=await tx.order.findUnique({where:{idempotencyKey},include:{location:true}}); if(existing) return hydrate(existing);
        const user=await tx.user.findUnique({where:{telegramId:BigInt(telegramId)}}); if(!user||user.accountStatus!=='ACTIVE') throw new Error('ACCOUNT_UNAVAILABLE');
        const product=await tx.product.findUnique({where:{id:productId}}); if(!product||!product.active) throw new Error('PRODUCT_UNAVAILABLE');
        const inv=await tx.inventory.findFirst({where:{productId,active:true,quantity:{gt:0},location:{active:true,cityId,city:{active:true}}},include:{location:{include:{city:true}}},orderBy:{quantity:'desc'}});
        if(!inv) throw new Error('OUT_OF_STOCK');
        const debit=await tx.user.updateMany({where:{id:user.id,balance:{gte:product.price}},data:{balance:{decrement:product.price}}}); if(debit.count!==1) throw new Error('INSUFFICIENT_FUNDS');
        const stock=await tx.inventory.updateMany({where:{id:inv.id,quantity:{gt:0}},data:{quantity:{decrement:1}}}); if(stock.count!==1) throw new Error('OUT_OF_STOCK');
        const fresh=await tx.user.findUnique({where:{id:user.id}});
        const order=await tx.order.create({data:{publicOrderId:publicId('ORD'),userId:user.id,productId:product.id,locationId:inv.location.id,productNameSnapshot:product.name,price:product.price,cityNameSnapshot:inv.location.city.name,status:'PAID',idempotencyKey},include:{location:true}});
        await tx.walletTransaction.create({data:{userId:user.id,type:'PURCHASE',amount:product.price.negated(),balanceBefore:user.balance,balanceAfter:fresh.balance,referenceId:order.publicOrderId}});
        if(user.referralParentId){
          const cfg=await tx.setting.findUnique({where:{key:'affiliatePercent'}}); const pct=Number(cfg?.value?.percent ?? 5);
          if(Number.isFinite(pct)&&pct>0&&pct<=50){
            const parent=await tx.user.findUnique({where:{id:user.referralParentId}});
            if(parent&&parent.accountStatus==='ACTIVE'){
              const reward=product.price.mul(pct).div(100).toDecimalPlaces(2);
              if(reward.gt(0)){ const parentAfter=parent.balance.add(reward); await tx.user.update({where:{id:parent.id},data:{balance:{increment:reward},affiliateBalance:{increment:reward},lifetimeCommission:{increment:reward}}}); await tx.walletTransaction.create({data:{userId:parent.id,type:'AFFILIATE_REWARD',amount:reward,balanceBefore:parent.balance,balanceAfter:parentAfter,referenceId:order.publicOrderId}}); }
            }
          }
        }
        return {...hydrate(order),balanceAfter:fresh.balance.toString()};
      },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
    }catch(e){ if((e.code==='P2034'||String(e.message).includes('write conflict'))&&attempt<2) continue; throw e; }
  }
}
function hydrate(order){ const l=order.location; return {...order,address:decrypt(l.privateAddressEnc),latitude:decrypt(l.latitudeEnc),longitude:decrypt(l.longitudeEnc),instructions:decrypt(l.privateInstructionsEnc)}; }
