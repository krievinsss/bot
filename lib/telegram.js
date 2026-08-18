const API=()=>`https://api.telegram.org/bot${process.env.BOT_TOKEN}`;
async function call(method,body){ const r=await fetch(`${API()}/${method}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),cache:'no-store'}); const j=await r.json(); if(!j.ok) throw new Error(`Telegram ${method} failed`); return j.result; }
export const tg={
  sendMessage:(chat_id,text,extra={})=>call('sendMessage',{chat_id,text,parse_mode:'HTML',...extra}),
  sendPhoto:(chat_id,photo,caption,extra={})=>call('sendPhoto',{chat_id,photo,caption,parse_mode:'HTML',...extra}),
  sendPhotoBytes:async(chat_id,bytes,filename='image.jpg',caption='')=>{ const form=new FormData(); form.set('chat_id',String(chat_id)); form.set('caption',caption); form.set('photo',new Blob([bytes]),filename); const r=await fetch(`${API()}/sendPhoto`,{method:'POST',body:form,cache:'no-store'}); const j=await r.json(); if(!j.ok) throw new Error('Telegram sendPhoto failed'); return j.result; },
  sendLocation:(chat_id,latitude,longitude)=>call('sendLocation',{chat_id,latitude:Number(latitude),longitude:Number(longitude)}),
  answerCallback:(callback_query_id,text='')=>call('answerCallbackQuery',{callback_query_id,text}),
};
export function mainKeyboard(){ return {keyboard:[[{text:'🛍 Shopping'},{text:'💵 Add Funds'}],[{text:'👤 Account'},{text:'☎️ Support'}]],resize_keyboard:true}; }
export function inline(rows){ return {inline_keyboard:rows}; }
export function esc(s=''){ return String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'); }
