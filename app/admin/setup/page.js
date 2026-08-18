import { prisma } from '../../../lib/db.js';
import AdminSetup from '../../../components/AdminSetup.js';

export const dynamic = 'force-dynamic';

export default async function AdminSetupPage() {
  const adminCount = await prisma.admin.count();
  const email = String(process.env.SEED_ADMIN_EMAIL || '').trim();
  const password = String(process.env.SEED_ADMIN_PASSWORD || '');

  const configured = {
    email: email.length > 0,
    password: password.length >= 12,
    ready: email.length > 0 && password.length >= 12,
  };

  return (
    <main className="min-h-screen grid place-items-center p-8">
      <AdminSetup configured={configured} adminExists={adminCount > 0} />
    </main>
  );
}
