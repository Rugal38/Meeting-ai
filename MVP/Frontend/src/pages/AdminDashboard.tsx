import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import ThemeToggle from '../components/ThemeToggle';
import { motion } from 'framer-motion';
import {
  Users, DollarSign, Activity, AlertTriangle,
  ChevronLeft, Search, RefreshCw, Shield,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { adminApi } from '../services/api';
import type { AdminStats, AdminUser, AdminJob, PlanTier } from '../types';
import { pageVariants, containerVariants, cardVariants } from '../lib/animations';

const PLAN_COLORS: Record<PlanTier, string> = {
  free:     'plan-badge-free',
  pro:      'plan-badge-pro',
  business: 'plan-badge-business',
};

const STATUS_COLORS: Record<string, string> = {
  active:   'badge-success',
  past_due: 'badge-warning',
  canceled: 'badge-error',
  trialing: 'badge-info',
};

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string | number; sub?: string }) {
  return (
    <motion.div className="stat-card" variants={cardVariants}>
      <div className="stat-icon">{icon}</div>
      <div>
        <div className="stat-value">{value}</div>
        <div className="stat-label">{label}</div>
        {sub && <div className="stat-sub">{sub}</div>}
      </div>
    </motion.div>
  );
}

type AdminTab = 'overview' | 'users' | 'jobs';

export default function AdminDashboard() {
  const [tab, setTab] = useState<AdminTab>('overview');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [jobs, setJobs] = useState<AdminJob[]>([]);
  const [search, setSearch] = useState('');
  const [overridingPlan, setOverridingPlan] = useState<number | null>(null);
  const navigate = useNavigate();

  const fetchStats = useCallback(async () => {
    try {
      const { data } = await adminApi.getStats();
      setStats(data);
    } catch { toast.error('Impossible de charger les statistiques.'); }
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      const { data } = await adminApi.getUsers({ search: search || undefined });
      setUsers(data);
    } catch { toast.error('Impossible de charger les utilisateurs.'); }
  }, [search]);

  const fetchJobs = useCallback(async () => {
    try {
      const { data } = await adminApi.getJobs({ limit: 100 });
      setJobs(data);
    } catch { toast.error('Impossible de charger les jobs.'); }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);
  useEffect(() => { if (tab === 'users') fetchUsers(); }, [tab, fetchUsers]);
  useEffect(() => { if (tab === 'jobs') fetchJobs(); }, [tab, fetchJobs]);

  const handleOverridePlan = async (userId: number, planTier: string) => {
    setOverridingPlan(userId);
    try {
      await adminApi.overridePlan(userId, planTier);
      toast.success(`Plan mis à jour : ${planTier}`);
      fetchUsers();
    } catch {
      toast.error('Impossible de changer le plan.');
    } finally {
      setOverridingPlan(null);
    }
  };

  const handleResetUsage = async (userId: number) => {
    try {
      await adminApi.resetUsage(userId);
      toast.success('Utilisation réinitialisée.');
      fetchUsers();
    } catch {
      toast.error('Impossible de réinitialiser.');
    }
  };

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

  const fmtStatus = (s: string) => {
    const map: Record<string, string> = {
      active: 'Actif', past_due: 'En retard', canceled: 'Annulé', trialing: 'Essai',
    };
    return map[s] ?? s;
  };

  return (
    <motion.div
      className="dashboard-layout"
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="ai-wave sidebar-logo-icon">
            {[12, 20, 28, 20, 12].map((h, i) => (
              <span key={i} className="ai-wave-bar"
                style={{ height: h, '--i-delay': `${i * 0.14}s` } as React.CSSProperties} />
            ))}
          </div>
          <span className="sidebar-logo-text">MeetingAI</span>
        </div>
        <nav className="sidebar-nav">
          <div className="nav-item" onClick={() => navigate('/dashboard')} style={{ cursor: 'pointer' }}>
            <ChevronLeft size={16} /> Mes Réunions
          </div>
          <div className="nav-item active">
            <Shield size={16} /> Administration
          </div>
        </nav>
        <div className="sidebar-footer" style={{ marginTop: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <ThemeToggle />
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="main-content">
        <div className="content-wrapper">
          <div className="content-header">
            <div>
              <h1 className="page-title">Administration</h1>
              <p className="page-subtitle">Vue d'ensemble de la plateforme</p>
            </div>
          </div>

          {/* Tab nav */}
          <div className="tab-nav" style={{ marginBottom: '1.5rem' }}>
            {([
              { id: 'overview', label: 'Vue d\'ensemble' },
              { id: 'users',    label: 'Utilisateurs' },
              { id: 'jobs',     label: 'Jobs' },
            ] as { id: AdminTab; label: string }[]).map((t) => (
              <button
                key={t.id}
                className={`tab-btn ${tab === t.id ? 'active' : ''}`}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Overview tab */}
          {tab === 'overview' && stats && (
            <motion.div variants={containerVariants} initial="hidden" animate="show">
              <div className="stats-grid">
                <StatCard icon={<Users size={20} />} label="Utilisateurs" value={stats.totalUsers} />
                <StatCard
                  icon={<DollarSign size={20} />}
                  label="MRR"
                  value={`$${stats.mrr.toFixed(2)}`}
                  sub="mensuel récurrent"
                />
                <StatCard
                  icon={<Activity size={20} />}
                  label="Jobs actifs"
                  value={stats.activeJobs}
                />
                <StatCard
                  icon={<AlertTriangle size={20} />}
                  label="Échecs 24h"
                  value={stats.failedJobs24h}
                />
              </div>

              <motion.div className="content-card" variants={cardVariants} style={{ marginTop: '1.5rem' }}>
                <h2 className="card-title">Abonnements par plan</h2>
                <div className="plan-distribution">
                  {(['free', 'pro', 'business'] as PlanTier[]).map((plan) => {
                    const count = stats.subscriptionsByPlan[plan] ?? 0;
                    const total = stats.totalUsers || 1;
                    return (
                      <div key={plan} className="plan-dist-row">
                        <span className={`plan-badge plan-badge-${plan}`}>{plan.toUpperCase()}</span>
                        <div className="usage-bar-track" style={{ flex: 1 }}>
                          <div className="usage-bar-fill" style={{ width: `${(count / total) * 100}%` }} />
                        </div>
                        <span className="plan-dist-count">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            </motion.div>
          )}

          {/* Users tab */}
          {tab === 'users' && (
            <motion.div variants={containerVariants} initial="hidden" animate="show">
              <motion.div variants={cardVariants} style={{ marginBottom: '1rem', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <div className="search-box">
                  <Search size={14} />
                  <input
                    className="search-input"
                    placeholder="Rechercher par email…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && fetchUsers()}
                  />
                </div>
                <motion.button className="btn-icon" onClick={fetchUsers} whileHover={{ scale: 1.05 }}>
                  <RefreshCw size={15} />
                </motion.button>
              </motion.div>

              <motion.div className="content-card" variants={cardVariants}>
                <div className="admin-table-wrapper">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Email</th>
                        <th>Plan</th>
                        <th>Statut</th>
                        <th>Usage (min)</th>
                        <th>Résumés</th>
                        <th>Inscrit le</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u) => (
                        <tr key={u.id}>
                          <td>
                            <div className="admin-user-cell">
                              <div className="user-avatar-sm">{u.email.charAt(0).toUpperCase()}</div>
                              <div>
                                <div>{u.email}</div>
                                {u.nom && <div className="admin-user-nom">{u.nom}</div>}
                              </div>
                            </div>
                          </td>
                          <td>
                            <span className={`plan-badge plan-badge-${u.planTier}`}>
                              {u.planTier.toUpperCase()}
                            </span>
                          </td>
                          <td>
                            <span className={`status-badge-sm ${STATUS_COLORS[u.subscriptionStatus] ?? ''}`}>
                              {fmtStatus(u.subscriptionStatus)}
                            </span>
                          </td>
                          <td>{u.usage ? u.usage.transcriptionMinutesUsed.toFixed(1) : '—'}</td>
                          <td>{u.usage ? u.usage.summariesGenerated : '—'}</td>
                          <td>{fmtDate(u.dateCreation)}</td>
                          <td>
                            <div className="admin-actions">
                              <select
                                className="plan-override-select"
                                value={u.planTier}
                                disabled={overridingPlan === u.id}
                                onChange={(e) => handleOverridePlan(u.id, e.target.value)}
                              >
                                <option value="free">Free</option>
                                <option value="pro">Pro</option>
                                <option value="business">Business</option>
                              </select>
                              <motion.button
                                className="btn-reset-usage"
                                onClick={() => handleResetUsage(u.id)}
                                whileHover={{ scale: 1.05 }}
                                title="Réinitialiser l'utilisation"
                              >
                                <RefreshCw size={12} />
                              </motion.button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {users.length === 0 && (
                        <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>Aucun utilisateur trouvé</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            </motion.div>
          )}

          {/* Jobs tab */}
          {tab === 'jobs' && (
            <motion.div variants={containerVariants} initial="hidden" animate="show">
              <motion.div className="content-card" variants={cardVariants}>
                <div className="admin-table-wrapper">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Réunion</th>
                        <th>Utilisateur</th>
                        <th>Statut</th>
                        <th>Créé le</th>
                        <th>Terminé le</th>
                      </tr>
                    </thead>
                    <tbody>
                      {jobs.map((job) => (
                        <tr key={job.id}>
                          <td style={{ color: 'var(--text-muted)', fontFamily: 'monospace' }}>#{job.id}</td>
                          <td>{job.meetingTitre ?? `Réunion #${job.meetingId}`}</td>
                          <td style={{ color: 'var(--text-secondary)' }}>{job.userEmail ?? '—'}</td>
                          <td>
                            <span className={`status-badge ${job.statut.toLowerCase()}`}>
                              <span className="status-dot" />
                              {job.statut}
                            </span>
                          </td>
                          <td>{fmtDate(job.dateCreation)}</td>
                          <td>{job.dateFin ? fmtDate(job.dateFin) : '—'}</td>
                        </tr>
                      ))}
                      {jobs.length === 0 && (
                        <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>Aucun job trouvé</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            </motion.div>
          )}
        </div>
      </main>
    </motion.div>
  );
}
