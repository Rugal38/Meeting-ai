import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import ThemeToggle from '../components/ThemeToggle';
import {
  Mic, FileText, Zap, Shield, Clock, Users,
  CheckCircle, ArrowRight, Building2,
} from 'lucide-react';

const WAVE_HEIGHTS = [14, 24, 38, 52, 64, 72, 64, 52, 38, 24, 14, 20, 34, 50, 62];

const FEATURES = [
  {
    icon: <Mic size={22} />,
    title: 'Transcription automatique',
    desc: 'Audio, vidéo ou PDF — notre IA transcrit vos réunions en quelques minutes avec une précision remarquable.',
  },
  {
    icon: <FileText size={22} />,
    title: 'Résumés intelligents',
    desc: 'Points clés, conclusions et plan d\'action générés automatiquement. Fini les notes de réunion.',
  },
  {
    icon: <Zap size={22} />,
    title: 'Résultats rapides',
    desc: 'Une heure de réunion analysée en moins de 30 minutes. Votre temps est précieux.',
  },
  {
    icon: <Shield size={22} />,
    title: 'Données sécurisées',
    desc: 'Vos enregistrements restent sur votre infrastructure. Aucun partage avec des tiers.',
  },
];

const STEPS = [
  { num: '01', title: 'Uploadez', desc: 'Déposez votre fichier audio, vidéo ou PDF.' },
  { num: '02', title: 'Analysez', desc: 'Notre IA transcrit et extrait les insights clés.' },
  { num: '03', title: 'Agissez', desc: 'Accédez au résumé, aux points clés et aux conclusions.' },
];

const PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    sub: 'Pour commencer',
    features: ['30 min de transcription / mois', '10 résumés / mois', 'Audio & Vidéo'],
    cta: 'Commencer gratuitement',
    featured: false,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$9.99',
    sub: '/ mois',
    features: ['600 min de transcription / mois', '100 résumés / mois', 'Audio, Vidéo & PDF', 'Support prioritaire'],
    cta: 'Essayer Pro',
    featured: true,
  },
  {
    id: 'business',
    name: 'Business',
    price: '$29.99',
    sub: '/ mois',
    features: ['Transcription illimitée', 'Résumés illimités', 'Tous les formats', 'File d\'attente prioritaire'],
    cta: 'Contacter l\'équipe',
    featured: false,
  },
];

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
};

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1 } },
};

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="landing-root">

      {/* ── Nav ── */}
      <header className="landing-nav">
        <div className="landing-nav-inner">
          <div className="landing-logo">
            <div className="ai-wave landing-logo-wave">
              {[10, 18, 26, 18, 10].map((h, i) => (
                <span
                  key={i}
                  className="ai-wave-bar"
                  style={{ height: h, '--i-delay': `${i * 0.14}s` } as React.CSSProperties}
                />
              ))}
            </div>
            <span className="landing-logo-text">MeetingAI</span>
          </div>
          <div className="landing-nav-actions">
            <ThemeToggle />
            <button className="landing-btn-ghost" onClick={() => navigate('/login')}>
              Se connecter
            </button>
            <motion.button
              className="landing-btn-primary"
              onClick={() => navigate('/signup')}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
            >
              Essayer gratuitement
            </motion.button>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="landing-hero">
        <motion.div
          className="landing-hero-inner"
          variants={stagger}
          initial="hidden"
          animate="show"
        >
          <motion.div className="landing-hero-badge" variants={fadeUp}>
            <Zap size={13} /> Alimenté par Mistral-7B + Whisper
          </motion.div>

          <motion.h1 className="landing-hero-title" variants={fadeUp}>
            Vos réunions,<br />
            <span className="landing-hero-accent">résumées en minutes.</span>
          </motion.h1>

          <motion.p className="landing-hero-sub" variants={fadeUp}>
            Uploadez un enregistrement audio, vidéo ou PDF. MeetingAI le transcrit,
            l'analyse et vous livre les points clés — sans effort.
          </motion.p>

          <motion.div className="landing-hero-ctas" variants={fadeUp}>
            <motion.button
              className="landing-cta-main"
              onClick={() => navigate('/signup')}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
            >
              Commencer gratuitement <ArrowRight size={16} />
            </motion.button>
            <button className="landing-cta-secondary" onClick={() => navigate('/login')}>
              Déjà un compte ? Se connecter
            </button>
          </motion.div>

          <motion.div className="landing-hero-wave" variants={fadeUp}>
            <div className="ai-wave landing-big-wave">
              {WAVE_HEIGHTS.map((h, i) => (
                <span
                  key={i}
                  className="ai-wave-bar"
                  style={{ height: h, '--i-delay': `${i * 0.06}s` } as React.CSSProperties}
                />
              ))}
            </div>
          </motion.div>

          <motion.div className="landing-hero-stats" variants={fadeUp}>
            {[
              { value: '<30min', label: 'Pour 1h de réunion' },
              { value: '3 formats', label: 'Audio · Vidéo · PDF' },
              { value: '100%', label: 'Données privées' },
            ].map((s) => (
              <div key={s.label} className="landing-stat">
                <span className="landing-stat-value">{s.value}</span>
                <span className="landing-stat-label">{s.label}</span>
              </div>
            ))}
          </motion.div>
        </motion.div>
      </section>

      {/* ── How it works ── */}
      <section className="landing-section">
        <div className="landing-section-inner">
          <motion.div
            className="landing-section-header"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="landing-section-title">Comment ça marche ?</h2>
            <p className="landing-section-sub">Trois étapes. C'est tout.</p>
          </motion.div>

          <motion.div
            className="landing-steps"
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
          >
            {STEPS.map((step) => (
              <motion.div key={step.num} className="landing-step" variants={fadeUp}>
                <div className="landing-step-num">{step.num}</div>
                <h3 className="landing-step-title">{step.title}</h3>
                <p className="landing-step-desc">{step.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="landing-section landing-section-alt">
        <div className="landing-section-inner">
          <motion.div
            className="landing-section-header"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="landing-section-title">Tout ce dont vous avez besoin</h2>
            <p className="landing-section-sub">Une IA conçue pour les équipes qui bougent vite.</p>
          </motion.div>

          <motion.div
            className="landing-features-grid"
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
          >
            {FEATURES.map((f) => (
              <motion.div key={f.title} className="landing-feature-card" variants={fadeUp}>
                <div className="landing-feature-icon">{f.icon}</div>
                <h3 className="landing-feature-title">{f.title}</h3>
                <p className="landing-feature-desc">{f.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Social proof ── */}
      <section className="landing-section">
        <div className="landing-section-inner">
          <motion.div
            className="landing-testimonials"
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
          >
            {[
              { quote: 'MeetingAI m\'a économisé 3 heures par semaine. Les résumés sont précis et directement actionnables.', author: 'Chef de projet, startup tech' },
              { quote: 'L\'IA comprend parfaitement le contexte même sur des réunions techniques très denses.', author: 'Lead développeur, scale-up' },
              { quote: 'On a adopté MeetingAI pour toute l\'équipe. Le gain de productivité est immédiat.', author: 'Directrice des opérations' },
            ].map((t, i) => (
              <motion.div key={i} className="landing-testimonial" variants={fadeUp}>
                <div className="landing-testimonial-stars">{'★'.repeat(5)}</div>
                <p className="landing-testimonial-quote">"{t.quote}"</p>
                <span className="landing-testimonial-author">— {t.author}</span>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section className="landing-section landing-section-alt" id="pricing">
        <div className="landing-section-inner">
          <motion.div
            className="landing-section-header"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="landing-section-title">Tarifs simples et transparents</h2>
            <p className="landing-section-sub">Commencez gratuitement. Évoluez quand vous êtes prêt.</p>
          </motion.div>

          <motion.div
            className="landing-pricing-grid"
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
          >
            {PLANS.map((plan) => (
              <motion.div
                key={plan.id}
                className={`landing-plan-card ${plan.featured ? 'landing-plan-featured' : ''}`}
                variants={fadeUp}
                whileHover={{ y: -6, transition: { duration: 0.2 } }}
              >
                {plan.featured && <div className="landing-plan-popular">Populaire</div>}
                <div className="landing-plan-icon">
                  {plan.id === 'free' ? <CheckCircle size={20} /> : plan.id === 'pro' ? <Zap size={20} /> : <Building2 size={20} />}
                </div>
                <h3 className="landing-plan-name">{plan.name}</h3>
                <div className="landing-plan-price">
                  <span className="landing-plan-amount">{plan.price}</span>
                  <span className="landing-plan-period">{plan.sub}</span>
                </div>
                <ul className="landing-plan-features">
                  {plan.features.map((f) => (
                    <li key={f} className="landing-plan-feature">
                      <CheckCircle size={13} style={{ color: 'var(--teal)', flexShrink: 0 }} />
                      {f}
                    </li>
                  ))}
                </ul>
                <motion.button
                  className={`landing-plan-cta ${plan.featured ? 'landing-plan-cta-featured' : ''}`}
                  onClick={() => navigate('/signup')}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                >
                  {plan.cta}
                </motion.button>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="landing-cta-section">
        <div className="landing-section-inner">
          <motion.div
            className="landing-cta-box"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <div className="ai-wave landing-cta-wave">
              {[10, 18, 28, 18, 10].map((h, i) => (
                <span key={i} className="ai-wave-bar"
                  style={{ height: h, '--i-delay': `${i * 0.14}s` } as React.CSSProperties} />
              ))}
            </div>
            <h2 className="landing-cta-title">Prêt à reprendre le contrôle de vos réunions ?</h2>
            <p className="landing-cta-sub">Rejoignez les équipes qui gagnent du temps chaque semaine.</p>
            <motion.button
              className="landing-cta-main"
              onClick={() => navigate('/signup')}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
            >
              Créer un compte gratuit <ArrowRight size={16} />
            </motion.button>
          </motion.div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="landing-footer">
        <div className="landing-section-inner">
          <div className="landing-footer-inner">
            <div className="landing-logo">
              <div className="ai-wave landing-logo-wave">
                {[8, 14, 20, 14, 8].map((h, i) => (
                  <span key={i} className="ai-wave-bar"
                    style={{ height: h, '--i-delay': `${i * 0.14}s` } as React.CSSProperties} />
                ))}
              </div>
              <span className="landing-logo-text" style={{ fontSize: '0.95rem' }}>MeetingAI</span>
            </div>
            <div className="landing-footer-links">
              <button className="landing-footer-link" onClick={() => navigate('/login')}>Connexion</button>
              <button className="landing-footer-link" onClick={() => navigate('/signup')}>Inscription</button>
              <a className="landing-footer-link" href="#pricing">Tarifs</a>
            </div>
            <p className="landing-footer-copy">© 2025 MeetingAI. Tous droits réservés.</p>
          </div>
        </div>
      </footer>

    </div>
  );
}
