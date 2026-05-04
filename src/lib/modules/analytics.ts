// Analytics Engine — single function that computes all admin metrics.
// Reusable: call from dashboard, reports, or future API.

import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  return createClient(url, key);
}

export type AdminMetrics = {
  // Revenue
  totalRevenue: number;
  pipelineValue: number;
  avgProjectValue: number;
  // Volume
  totalClients: number;
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  // Conversion
  leadToProjectRate: number; // % of clients who have at least one project
  // Stage breakdown
  stageBreakdown: Record<string, number>;
  // Services sold
  topServices: { name: string; count: number }[];
  // Recent activity (last 30 days)
  revenueThisMonth: number;
  newClientsThisMonth: number;
  newProjectsThisMonth: number;
};

export async function getAdminMetrics(): Promise<AdminMetrics> {
  const sb = getSupabase();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [clientsRes, projectsRes, paymentsRes] = await Promise.all([
    sb.from('clients').select('id, status, created_at', { count: 'exact' }),
    sb.from('projects').select('id, stage, service_name, total_amount_usd, created_at', { count: 'exact' }),
    sb.from('payments').select('amount_usd, status, paid_at'),
  ]);

  const clients = clientsRes.data || [];
  const projects = projectsRes.data || [];
  const payments = paymentsRes.data || [];

  const paidPayments = payments.filter(p => p.status === 'paid');
  const totalRevenue = paidPayments.reduce((s, p) => s + (p.amount_usd || 0), 0);

  const activeProjects = projects.filter(p => !['completed', 'delivering'].includes(p.stage || ''));
  const completedProjects = projects.filter(p => ['completed', 'delivering'].includes(p.stage || ''));

  const pipelineValue = activeProjects.reduce((s, p) => s + (p.total_amount_usd || 0), 0);

  const paidProjects = projects.filter(p => p.total_amount_usd && p.total_amount_usd > 0);
  const avgProjectValue = paidProjects.length > 0
    ? paidProjects.reduce((s, p) => s + (p.total_amount_usd || 0), 0) / paidProjects.length
    : 0;

  // Stage breakdown
  const stageBreakdown: Record<string, number> = {};
  for (const p of projects) {
    const stage = p.stage || 'lead';
    stageBreakdown[stage] = (stageBreakdown[stage] || 0) + 1;
  }

  // Top services
  const serviceCounts: Record<string, number> = {};
  for (const p of projects) {
    const name = p.service_name || 'Unknown';
    serviceCounts[name] = (serviceCounts[name] || 0) + 1;
  }
  const topServices = Object.entries(serviceCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Lead to project rate (clients with at least 1 project / total clients)
  const clientsWithProjects = new Set(projects.map(p => p.id)).size;
  const leadToProjectRate = clients.length > 0 ? (clientsWithProjects / clients.length) * 100 : 0;

  // This month
  const revenueThisMonth = paidPayments
    .filter(p => p.paid_at && p.paid_at >= thirtyDaysAgo)
    .reduce((s, p) => s + (p.amount_usd || 0), 0);

  const newClientsThisMonth = clients.filter(c => c.created_at >= thirtyDaysAgo).length;
  const newProjectsThisMonth = projects.filter(p => p.created_at >= thirtyDaysAgo).length;

  return {
    totalRevenue,
    pipelineValue,
    avgProjectValue,
    totalClients: clients.length,
    totalProjects: projects.length,
    activeProjects: activeProjects.length,
    completedProjects: completedProjects.length,
    leadToProjectRate,
    stageBreakdown,
    topServices,
    revenueThisMonth,
    newClientsThisMonth,
    newProjectsThisMonth,
  };
}
