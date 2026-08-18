import { destroyAdminSession } from '../../../../lib/auth.js'; export async function POST(){ await destroyAdminSession(); return Response.json({ok:true}); }
