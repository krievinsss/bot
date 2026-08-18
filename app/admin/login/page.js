import AdminLogin from '../../../components/AdminLogin.js';
import { getAdmin } from '../../../lib/auth.js';
import { prisma } from '../../../lib/db.js';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function Page() {
  if (await getAdmin()) redirect('/admin/dashboard');

  const adminCount = await prisma.admin.count();
  if (adminCount === 0) redirect('/admin/setup');

  return (
    <main className="min-h-screen grid place-items-center p-8">
      <AdminLogin />
    </main>
  );
}
