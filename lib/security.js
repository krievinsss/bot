import crypto from 'crypto';

export function randomToken(bytes=32){ return crypto.randomBytes(bytes).toString('base64url'); }
export function sha256(value){ return crypto.createHash('sha256').update(value).digest('hex'); }
export function safeEqual(a,b){
  const aa=Buffer.from(String(a||'')); const bb=Buffer.from(String(b||''));
  return aa.length===bb.length && crypto.timingSafeEqual(aa,bb);
}
export function hashPassword(password){
  const salt=crypto.randomBytes(16);
  const hash=crypto.scryptSync(password, salt, 64, {N:16384,r:8,p:1});
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`;
}
export function verifyPassword(password, encoded){
  try { const [alg,saltB64,hashB64]=encoded.split('$'); if(alg!=='scrypt') return false;
    const expected=Buffer.from(hashB64,'base64'); const actual=crypto.scryptSync(password,Buffer.from(saltB64,'base64'),expected.length,{N:16384,r:8,p:1});
    return crypto.timingSafeEqual(expected,actual);
  } catch { return false; }
}
export function getClientIp(req){ return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'; }
export function assertSameOrigin(req){
  if (['GET','HEAD','OPTIONS'].includes(req.method)) return;
  const origin=req.headers.get('origin'); const app=process.env.APP_URL;
  if (!origin || !app || new URL(origin).origin !== new URL(app).origin) throw new Error('INVALID_ORIGIN');
}
