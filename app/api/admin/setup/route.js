import { prisma } from '../../../../lib/db.js';
import { hashPassword } from '../../../../lib/security.js';
import { audit } from '../../../../lib/audit.js';

export const dynamic = 'force-dynamic';

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST() {
  try {
    const email = String(process.env.SEED_ADMIN_EMAIL || '').trim().toLowerCase();
    const password = String(process.env.SEED_ADMIN_PASSWORD || '');

    if (!validEmail(email) || password.length < 12) {
      return Response.json(
        { error: 'Configure SEED_ADMIN_EMAIL and a SEED_ADMIN_PASSWORD of at least 12 characters, then redeploy.' },
        { status: 503 },
      );
    }

    const passwordHash = hashPassword(password);

    const result = await prisma.$transaction(async (tx) => {
      const admins = await tx.admin.findMany({
        orderBy: { createdAt: 'asc' },
        take: 3,
        select: { id: true, email: true },
      });

      let admin;
      let mode;

      if (admins.length === 0) {
        admin = await tx.admin.create({
          data: { email, passwordHash, role: 'OWNER', active: true },
          select: { id: true },
        });
        mode = 'created';
      } else if (admins.length === 1) {
        admin = await tx.admin.update({
          where: { id: admins[0].id },
          data: { email, passwordHash, role: 'OWNER', active: true },
          select: { id: true },
        });
        mode = 'synchronized';
      } else {
        const matching = admins.find((item) => item.email.toLowerCase() === email);
        if (!matching) {
          return { blocked: true };
        }
        admin = await tx.admin.update({
          where: { id: matching.id },
          data: { passwordHash, active: true },
          select: { id: true },
        });
        mode = 'synchronized';
      }

      // Clear stale failed attempts for this configured email so recovery can be used immediately.
      await tx.loginAttempt.deleteMany({ where: { key: { endsWith: `:${email}` } } });

      return { blocked: false, adminId: admin.id, mode };
    });

    if (result.blocked) {
      return Response.json(
        { error: 'Multiple administrators exist and none matches SEED_ADMIN_EMAIL. Automatic recovery is disabled.' },
        { status: 409 },
      );
    }

    await audit(result.mode === 'created' ? 'ADMIN_INITIALIZED' : 'ADMIN_CREDENTIALS_SYNCHRONIZED', {
      actorType: 'SYSTEM',
      targetType: 'Admin',
      targetId: result.adminId,
    });

    return Response.json({ ok: true, mode: result.mode });
  } catch (error) {
    console.error('admin_setup_failed', error?.message || 'unknown');
    return Response.json({ error: 'Administrator setup failed.' }, { status: 500 });
  }
}
