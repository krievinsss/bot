import AdminLogin from '../../../components/AdminLogin.js'; import { getAdmin } from '../../../lib/auth.js'; import { redirect } from 'next/navigation';
export default async function Page(){ if(await getAdmin()) redirect('/admin/dashboard'); return <main className="min-h-screen grid place-items-center p-8"><AdminLogin/></main>; }
