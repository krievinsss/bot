import { prisma } from './db.js';
import { sha256 } from './security.js';
export async function audit(event,{actorType='SYSTEM',actorId=null,targetType=null,targetId=null,ip=null,metadata=null}={}){
  try { await prisma.auditLog.create({data:{event,actorType,actorId,targetType,targetId,ipHash:ip?sha256(ip):null,metadata}}); } catch(e){ console.error('audit_failed',e?.message); }
}
