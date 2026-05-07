import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { toCSV } from '@/lib/csv';

export async function GET() {
  const session = await getSession();
  if (!session.userId) return new Response('Unauthenticated', { status: 401 });
  const ds = await prisma.dashboard.findMany({
    where: { archivedAt: null },
    include: { deOwner: true, biOwner: true },
    orderBy: { id: 'asc' }
  });
  const rows = ds.map(d => ({
    id: d.id, name: d.name, domain: d.domain, status: d.status, tier: d.tier,
    de_owner: d.deOwner?.name, bi_owner: d.biOwner?.name,
    source_system: d.sourceSystem, refresh_frequency: d.refreshFrequency,
    refresh_window: d.refreshWindow, business_sponsor: d.businessSponsor,
    data_owner: d.dataOwner, change_approver: d.changeApprover,
    escalation_contact: d.escalationContact, stakeholder_group: d.stakeholderGroup,
    access_rule: d.accessRule, change_control_rule: d.changeControlRule,
    data_sensitivity: d.dataSensitivity, notes: d.notes
  }));
  return new Response(toCSV(rows), {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': 'attachment; filename="portfolio.csv"'
    }
  });
}
