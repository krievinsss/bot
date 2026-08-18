import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { prisma } from './db.js';
import { randomToken, sha256 } from './security.js';
const COOKIE='admin_session';
export async function createAdminSession(adminId){
  const token=randomToken(32); const tokenHash=sha256(token); const expiresAt=new Date(Date.now()+8*60*60*1000);
  await prisma.adminSession.create({data:{adminId,tokenHash,expiresAt}});
  const c=await cookies(); c.set(COOKIE,token,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',path:'/',expires:expiresAt});
}
export async function getAdmin(){
  const token=(await cookies()).get(COOKIE)?.value; if(!token) return null;
  const session=await prisma.adminSession.findUnique({where:{tokenHash:sha256(token)},include:{admin:true}});
  if(!session || session.expiresAt<new Date() || !session.admin.active) return null;
  return session.admin;
}
export async function requireAdmin(){ const a=await getAdmin(); if(!a) redirect('/admin/login'); return a; }
export async function destroyAdminSession(){ const c=await cookies(); const token=c.get(COOKIE)?.value; if(token) await prisma.adminSession.deleteMany({where:{tokenHash:sha256(token)}}); c.delete(COOKIE); }
