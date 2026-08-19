import { get } from '@vercel/blob';

const API=()=>`https://api.telegram.org/bot${process.env.BOT_TOKEN}`;

async function call(method,body){
  const r=await fetch(`${API()}/${method}`,{
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify(body),
    cache:'no-store'
  });
  const j=await r.json();
  if(!j.ok){
    console.error(`Telegram ${method} failed`,j.description||'Unknown error');
    throw new Error(`Telegram ${method} failed`);
  }
  return j.result;
}

async function sendPhotoBytes(chat_id,bytes,filename='image.jpg',caption='',extra={}){
  const form=new FormData();
  form.set('chat_id',String(chat_id));
  if(caption) form.set('caption',caption);
  form.set('parse_mode','HTML');
  if(extra.reply_markup) form.set('reply_markup',JSON.stringify(extra.reply_markup));
  form.set('photo',new Blob([bytes]),filename);

  const r=await fetch(`${API()}/sendPhoto`,{method:'POST',body:form,cache:'no-store'});
  const j=await r.json();
  if(!j.ok){
    console.error('Telegram sendPhoto failed',j.description||'Unknown error');
    throw new Error('Telegram sendPhoto failed');
  }
  return j.result;
}

async function sendPhoto(chat_id,photo,caption,extra={}){
  // Product images are stored in a private Vercel Blob store. The database
  // contains our media-proxy URL, e.g. /api/media/product?path=products/....
  // Do not make Telegram fetch that URL. Read the private blob server-side
  // and upload the actual image bytes to Telegram instead.
  try{
    if(typeof photo==='string'){
      const u=new URL(photo,process.env.APP_URL||'https://localhost');
      const pathname=u.searchParams.get('path');
      if(pathname?.startsWith('products/')){
        const result=await get(pathname,{access:'private'});
        if(result?.stream){
          const bytes=Buffer.from(await new Response(result.stream).arrayBuffer());
          return sendPhotoBytes(chat_id,bytes,'product-image.jpg',caption,extra);
        }
      }
    }
  }catch(e){
    console.error('Private product image read failed',e?.message||e);
  }

  return call('sendPhoto',{chat_id,photo,caption,parse_mode:'HTML',...extra});
}

export const tg={
  sendMessage:(chat_id,text,extra={})=>call('sendMessage',{chat_id,text,parse_mode:'HTML',...extra}),
  sendPhoto,
  sendPhotoBytes,
  sendLocation:(chat_id,latitude,longitude)=>call('sendLocation',{chat_id,latitude:Number(latitude),longitude:Number(longitude)}),
  answerCallback:(callback_query_id,text='')=>call('answerCallbackQuery',{callback_query_id,text}),
};

export function mainKeyboard(){
  return {keyboard:[[{text:'🛍 Shopping'},{text:'💵 Add Funds'}],[{text:'👤 Account'},{text:'☎️ Support'}]],resize_keyboard:true};
}

export function inline(rows){ return {inline_keyboard:rows}; }
export function esc(s=''){ return String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'); }
