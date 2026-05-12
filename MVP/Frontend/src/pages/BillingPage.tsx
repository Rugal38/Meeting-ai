import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CreditCard, Zap, Building2, ChevronLeft, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import ThemeToggle from '../components/ThemeToggle';
import { billingApi, usageApi } from '../services/api';
import type { BillingStatus, UsageData, User } from '../types';
import { pageVariants, containerVariants, cardVariants } from '../lib/animations';

const PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    period: '/mois',
    features: ['30 min de transcription/mois', '10 résumés/mois', 'Audio & Vidéo'],
    priceId: null,
    icon: <CheckCircle size={20} />,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$9.99',
    period: '/mois',
    features: ['600 min de transcription/mois', '100 résumés/mois', 'Audio, Vidéo & PDF', 'Support prioritaire'],
    priceId: import.meta.env.VITE_STRIPE_PRO_PRICE_ID ?? '',
    icon: <Zap size={20} />,
  },
  {
    id: 'business',
    name: 'Business',
    price: '$29.99',
    period: '/mois',
    features: ['Transcription illimitée', 'Résumés illimités', 'Tous les formats', 'File d\'attente prioritaire'],
    priceId: import.meta.env.VITE_STRIPE_BUSINESS_PRICE_ID ?? '',
    icon: <Building2 size={20} />,
  },
] as const;

export default function BillingPage() {
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loadingCheckout, setLoadingCheckout] = useState<string | null>(null);
  const [loadingPortal, setLoadingPortal] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const raw = localStorage.getItem('user');
    if (raw) setUser(JSON.parse(raw) as User);

    billingApi.getStatus().then((r) => setBilling(r.data)).catch(() => {});
    usageApi.get().then((r) => setUsage(r.data)).catch(() => {});

    if (searchParams.get('success') === 'true') {
      toast.success('Abonnement activé ! Bienvenue 🎉');
    }
    if (searchParams.get('canceled') === 'true') {
      toast('Paiement annulé.');
    }
  }, [searchParams]);

  const handleUpgrade = async (priceId: string, planId: string) => {
    if (!priceId) {
      toast.error('Stripe n\'est pas encore configuré.');
      return;
    }
    setLoadingCheckout(planId);
    try {
      const { data } = await billingApi.createCheckoutSession(priceId);
      window.location.href = data.checkoutUrl;
    } catch {
      toast.error('Impossible de démarrer le paiement. Réessayez.');
      setLoadingCheckout(null);
    }
  };

  const handleManage = async () => {
    setLoadingPortal(true);
    try {
      const { data } = await billingApi.createPortalSession();
      window.location.href = data.portalUrl;
    } catch {
      toast.error('Impossible d\'ouvrir le portail. Réessayez.');
      setLoadingPortal(false);
    }
  };

  const currentPlan = billing?.planTier ?? 'free';

  const fmtDate = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';

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
            <CreditCard size={16} /> Facturation
          </div>
        </nav>
        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-avatar">{user?.nom?.charAt(0)?.toUpperCase()}</div>
            <div style={{ overflow: 'hidden' }}>
              <div className="user-name">{user?.nom}</div>
              <div className="user-email">{user?.email}</div>
            </div>
            <ThemeToggle />
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="main-content">
        <div className="content-wrapper">
          <div className="content-header">
            <div>
              <h1 className="page-title">Facturation</h1>
              <p className="page-subtitle">Gérez votre abonnement et votre utilisation</p>
            </div>
          </div>

          <motion.div variants={containerVariants} initial="hidden" animate="show">
            {/* Current plan card */}
            <motion.div className="billing-status-card" variants={cardVariants}>
              <div className="billing-status-left">
                <span className={`plan-badge-large plan-badge-${currentPlan}`}>
                  {currentPlan.toUpperCase()}
                </span>
                <div>
                  <p className="billing-plan-name">Plan {currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1)}</p>
                  {billing?.subscriptionStatus === 'past_due' && (
                    <p className="billing-past-due">Paiement en attente — mettez à jour votre moyen de paiement</p>
                  )}
                  {billing?.currentPeriodEnd && (
                    <p className="billing-renewal">Renouvellement le {fmtDate(billing.currentPeriodEnd)}</p>
                  )}
                </div>
              </div>
              {currentPlan !== 'free' && (
                <motion.button
                  className="btn-portal"
                  onClick={handleManage}
                  disabled={loadingPortal}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <CreditCard size={14} />
                  {loadingPortal ? 'Chargement…' : 'Gérer l\'abonnement'}
                </motion.button>
              )}
            </motion.div>

            {/* Usage summary */}
            {usage && (
              <motion.div className="billing-usage-card" variants={cardVariants}>
                <h2 className="card-section-title">Utilisation ce mois</h2>
                <div className="billing-usage-grid">
                  <div className="billing-usage-item">
                    <span className="billing-usage-label">Transcription</span>
                    <span className="billing-usage-value">
                      {usage.transcriptionMinutesUsed.toFixed(1)} /&nbsp;
                      {usage.limits.transcriptionMinutes === null ? '∞' : usage.limits.transcriptionMinutes} min
                    </span>
                    <div className="usage-bar-track">
                      <div
                        className="usage-bar-fill"
                        style={{
                          width: usage.limits.transcriptionMinutes === null ? '100%' :
                            `${Math.min((usage.transcriptionMinutesUsed / usage.limits.transcriptionMinutes) * 100, 100)}%`
                        }}
                        data-state={
                          usage.limits.transcriptionMinutes !== null &&
                          usage.transcriptionMinutesUsed / usage.limits.transcriptionMinutes >= 1 ? 'over' :
                          usage.limits.transcriptionMinutes !== null &&
                          usage.transcriptionMinutesUsed / usage.limits.transcriptionMinutes >= 0.8 ? 'warn' : ''
                        }
                      />
                    </div>
                  </div>
                  <div className="billing-usage-item">
                    <span className="billing-usage-label">Résumés</span>
                    <span className="billing-usage-value">
                      {usage.summariesGenerated} /&nbsp;
                      {usage.limits.summaries === null ? '∞' : usage.limits.summaries}
                    </span>
                    <div className="usage-bar-track">
                      <div
                        className="usage-bar-fill"
                        style={{
                          width: usage.limits.summaries === null ? '100%' :
                            `${Math.min((usage.summariesGenerated / usage.limits.summaries) * 100, 100)}%`
                        }}
                        data-state={
                          usage.limits.summaries !== null &&
                          usage.summariesGenerated / usage.limits.summaries >= 1 ? 'over' :
                          usage.limits.summaries !== null &&
                          usage.summariesGenerated / usage.limits.summaries >= 0.8 ? 'warn' : ''
                        }
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Plan cards */}
            <motion.div variants={cardVariants}>
              <h2 className="card-section-title" style={{ marginBottom: '1rem' }}>
                {currentPlan === 'free' ? 'Passez à la vitesse supérieure' : 'Changer de plan'}
              </h2>
              <div className="plan-cards-grid">
                {PLANS.map((plan) => {
                  const isCurrent = plan.id === currentPlan;
                  return (
                    <motion.div
                      key={plan.id}
                      className={`plan-card ${isCurrent ? 'plan-card-current' : ''} ${plan.id === 'pro' ? 'plan-card-featured' : ''}`}
                      whileHover={!isCurrent ? { y: -4 } : {}}
                    >
                      {plan.id === 'pro' && !isCurrent && (
                        <div className="plan-badge-popular">Populaire</div>
                      )}
                      <div className="plan-card-icon">{plan.icon}</div>
                      <h3 className="plan-card-name">{plan.name}</h3>
                      <div className="plan-card-price">
                        <span className="plan-price-amount">{plan.price}</span>
                        <span className="plan-price-period">{plan.period}</span>
                      </div>
                      <ul className="plan-features">
                        {plan.features.map((f) => (
                          <li key={f} className="plan-feature-item">
                            <CheckCircle size={13} style={{ color: 'var(--teal)', flexShrink: 0 }} />
                            {f}
                          </li>
                        ))}
                      </ul>
                      {isCurrent ? (
                        <div className="plan-current-label">Plan actuel</div>
                      ) : plan.priceId ? (
                        <motion.button
                          className={`btn-upgrade ${plan.id === 'pro' ? 'btn-upgrade-pro' : 'btn-upgrade-business'}`}
                          onClick={() => handleUpgrade(plan.priceId!, plan.id)}
                          disabled={loadingCheckout !== null}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          {loadingCheckout === plan.id ? 'Redirection…' : `Passer à ${plan.name}`}
                        </motion.button>
                      ) : null}
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          </motion.div>
        </div>
      </main>
    </motion.div>
  );
}
