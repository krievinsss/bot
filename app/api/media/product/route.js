import { get } from '@vercel/blob';
export async function GET(req){
  try{ const path=new URL(req.url).searchParams.get('path'); if(!path||!path.startsWith('products/')) return new Response('Not found',{status:404}); const blob=await get(path,{access:'private'}); if(!blob?.stream) return new Response('Not found',{status:404}); return new Response(blob.stream,{headers:{'content-type':blob.contentType||'application/octet-stream','cache-control':'public, max-age=3600, s-maxage=86400','x-content-type-options':'nosniff'}}); }catch{return new Response('Not found',{status:404});}
}
