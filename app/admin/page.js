import { getAdmin } from '../../lib/auth.js';
import { prisma } from '../../lib/db.js';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function AdminIndex() {
  const admin = await getAdmin();
  if (admin) redirect('/admin/dashboard');

  const adminCount = await prisma.admin.count();
  redirect(adminCount === 0 ? '/admin/setup' : '/admin/login');
}
