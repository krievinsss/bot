import { handleTelegram } from '../../../lib/bot-handler.js';
import { safeEqual } from '../../../lib/security.js';
export async function POST(req){
  try{ if(!safeEqual(req.headers.get('x-telegram-bot-api-secret-token'),process.env.TELEGRAM_WEBHOOK_SECRET)) return Response.json({error:'Request failed'},{status:401}); const update=await req.json(); await handleTelegram(update); return Response.json({ok:true}); }
  catch(e){ console.error('telegram_webhook_error',e?.message); return Response.json({error:'Request failed'},{status:500}); }
}
