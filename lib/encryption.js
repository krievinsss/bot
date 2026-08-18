import crypto from 'crypto';
function key(){
  const raw=process.env.DATA_ENCRYPTION_KEY; if(!raw) throw new Error('DATA_ENCRYPTION_KEY missing');
  const b=Buffer.from(raw,'base64'); if(b.length!==32) throw new Error('DATA_ENCRYPTION_KEY must decode to 32 bytes'); return b;
}
export function encrypt(value){
  if(value===null||value===undefined) return null;
  const iv=crypto.randomBytes(12); const cipher=crypto.createCipheriv('aes-256-gcm',key(),iv); const ct=Buffer.concat([cipher.update(String(value),'utf8'),cipher.final()]); const tag=cipher.getAuthTag();
  return `v1.${iv.toString('base64url')}.${tag.toString('base64url')}.${ct.toString('base64url')}`;
}
export function decrypt(blob){
  if(!blob) return '';
  const [v,ivb,tagb,ctb]=blob.split('.'); if(v!=='v1') throw new Error('Unsupported encryption version');
  const decipher=crypto.createDecipheriv('aes-256-gcm',key(),Buffer.from(ivb,'base64url')); decipher.setAuthTag(Buffer.from(tagb,'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(ctb,'base64url')),decipher.final()]).toString('utf8');
}
