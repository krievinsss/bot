import { NextResponse } from 'next/server';
export function proxy(request){
  const response=NextResponse.next();
  if(request.nextUrl.pathname.startsWith('/api/')) response.headers.set('Cache-Control','no-store');
  return response;
}
export const config={matcher:['/api/:path*']};
