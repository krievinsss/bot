import { prisma } from './db.js';
export async function checkLoginRateLimit(key,{windowMinutes=15,max=8}={}){
  const since=new Date(Date.now()-windowMinutes*60000); const count=await prisma.loginAttempt.count({where:{key,ok:false,createdAt:{gte:since}}});
  return count < max;
}
