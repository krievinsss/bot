import { get } from '@vercel/blob';
import { getAdmin } from '../../../../lib/auth.js';

export async function GET(req){
  const admin=await getAdmin();
  if(!admin) return new Response('Unauthorized',{status:401});

  try{
    const path=new URL(req.url).searchParams.get('path');
    if(!path||!path.startsWith('private/')) return new Response('Not found',{status:404});
    const blob=await get(path,{access:'private'});
    if(!blob?.stream) return new Response('Not found',{status:404});
    return new Response(blob.stream,{headers:{
      'content-type':blob.contentType||'application/octet-stream',
      'cache-control':'private, no-store',
      'x-content-type-options':'nosniff'
    }});
  }catch{
    return new Response('Not found',{status:404});
  }
}
