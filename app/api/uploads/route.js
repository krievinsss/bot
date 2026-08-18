import { getAdmin } from '../../../lib/auth.js';
import { put } from '@vercel/blob';
export async function POST(req){
  const a=await getAdmin(); if(!a) return Response.json({error:'Unauthorized'},{status:401});
  const fd=await req.formData(); const file=fd.get('file'); const kind=fd.get('kind')==='private'?'private':'products';
  if(!file||file.size>5*1024*1024||!['image/jpeg','image/png','image/webp'].includes(file.type)) return Response.json({error:'Invalid file'},{status:400});
  const blob=await put(`${kind}/${crypto.randomUUID()}-${file.name}`,file,{access:'private',addRandomSuffix:true});
  const reference=kind==='products'?`${process.env.APP_URL}/api/media/product?path=${encodeURIComponent(blob.pathname)}`:blob.pathname;
  return Response.json({ok:true,url:reference,pathname:blob.pathname});
}
