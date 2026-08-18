import { getAdmin } from '../../lib/auth.js';
import { redirect } from 'next/navigation';

export default async function AdminIndex() {
  const admin = await getAdmin();
  redirect(admin ? '/admin/dashboard' : '/admin/login');
}
