import { requireAdmin } from '../../../lib/auth.js'; import AdminShell from '../../../components/AdminShell.js';
export default async function Layout({children}){const admin=await requireAdmin();return <AdminShell admin={{email:admin.email,role:admin.role}}>{children}</AdminShell>}
