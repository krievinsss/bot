function base(){ return process.env.PAYPAL_MODE==='production'?'https://api-m.paypal.com':'https://api-m.sandbox.paypal.com'; }
async function accessToken(){
  const basic=Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString('base64');
  const r=await fetch(`${base()}/v1/oauth2/token`,{method:'POST',headers:{Authorization:`Basic ${basic}`,'content-type':'application/x-www-form-urlencoded'},body:'grant_type=client_credentials',cache:'no-store'});
  if(!r.ok) throw new Error('PayPal authentication failed'); return (await r.json()).access_token;
}
export async function createPayPalOrder(payment){
  const token=await accessToken();
  const r=await fetch(`${base()}/v2/checkout/orders`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'content-type':'application/json','PayPal-Request-Id':payment.publicId},body:JSON.stringify({intent:'CAPTURE',purchase_units:[{reference_id:payment.publicId,amount:{currency_code:payment.currency,value:Number(payment.amount).toFixed(2)},custom_id:payment.publicId}],payment_source:{paypal:{experience_context:{return_url:`${process.env.APP_URL}/payment/success`,cancel_url:`${process.env.APP_URL}/payment/cancel`,user_action:'PAY_NOW'}}}}),cache:'no-store'});
  const j=await r.json(); if(!r.ok) throw new Error('PayPal order creation failed'); return j;
}
export async function capturePayPalOrder(orderId){
  if(!orderId) throw new Error('Missing PayPal order ID');
  const token=await accessToken();

  const detailsRes=await fetch(`${base()}/v2/checkout/orders/${encodeURIComponent(orderId)}`,{headers:{Authorization:`Bearer ${token}`},cache:'no-store'});
  const details=await detailsRes.json().catch(()=>({}));
  if(!detailsRes.ok) throw new Error('PayPal order lookup failed');
  if(details.status==='COMPLETED') return details;
  if(details.status!=='APPROVED') throw new Error(`PayPal order not approved (${details.status||'unknown'})`);

  const r=await fetch(`${base()}/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`,{
    method:'POST',
    headers:{Authorization:`Bearer ${token}`,'content-type':'application/json','PayPal-Request-Id':`capture-${orderId}`},
    body:'{}',
    cache:'no-store'
  });
  const j=await r.json().catch(()=>({}));
  if(!r.ok) throw new Error(j?.message||'PayPal capture failed');
  return j;
}
export async function verifyPayPalWebhook(headers,event){
  const token=await accessToken();
  const body={auth_algo:headers.get('paypal-auth-algo'),cert_url:headers.get('paypal-cert-url'),transmission_id:headers.get('paypal-transmission-id'),transmission_sig:headers.get('paypal-transmission-sig'),transmission_time:headers.get('paypal-transmission-time'),webhook_id:process.env.PAYPAL_WEBHOOK_ID,webhook_event:event};
  const r=await fetch(`${base()}/v1/notifications/verify-webhook-signature`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify(body),cache:'no-store'});
  if(!r.ok) return false; return (await r.json()).verification_status==='SUCCESS';
}
