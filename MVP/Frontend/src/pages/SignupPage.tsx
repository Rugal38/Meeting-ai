import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, Lock, User, ArrowRight, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { pageVariants, slideInVariants } from '../lib/animations';

const BRAND_FEATURES = [
  'Transcription automatique FR / EN',
  'Résumé IA & points clés',
  'Historique de toutes vos réunions',
];

const WAVE_HEIGHTS = [20, 36, 52, 72, 88, 96, 84, 68, 52, 40, 56, 76, 92, 80, 64, 48, 36, 52, 68, 40];

export default function SignupPage() {
  const [nom, setNom] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error('Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/signup', { nom, email, password });
      toast.success('Compte créé ! Connectez-vous.');
      navigate('/login');
    } catch {
      toast.error("Erreur lors de l'inscription. L'email est peut-être déjà utilisé.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      className="auth-screen"
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      {/* ── Left brand panel ── */}
      <div className="auth-brand-panel">
        <motion.div
          className="auth-brand-logo"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0, transition: { delay: 0.08, duration: 0.5 } }}
        >
          <div className="ai-wave sidebar-logo-icon">
            {[12, 20, 28, 20, 12].map((h, i) => (
              <span
                key={i}
                className="ai-wave-bar"
                style={{ height: h, '--i-delay': `${i * 0.14}s` } as React.CSSProperties}
              />
            ))}
          </div>
          <span className="auth-brand-logo-text">MeetingAI</span>
          <span className="auth-brand-logo-dot" />
        </motion.div>

        <motion.div
          className="auth-wave-viz"
          initial={{ opacity: 0, scaleX: 0.85 }}
          animate={{ opacity: 1, scaleX: 1, transition: { delay: 0.15, duration: 0.7, ease: [0.22, 1, 0.36, 1] } }}
          style={{ transformOrigin: 'left center' }}
        >
          {WAVE_HEIGHTS.map((h, i) => (
            <span
              key={i}
              className="ai-wave-bar"
              style={{ height: h, '--i-delay': `${i * 0.06}s` } as React.CSSProperties}
            />
          ))}
        </motion.div>

        <motion.h1
          className="auth-brand-headline"
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0, transition: { delay: 0.22, duration: 0.55 } }}
        >
          Démarrez gratuitement<br />en <em>quelques secondes</em>
        </motion.h1>

        <motion.p
          className="auth-brand-sub"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0, transition: { delay: 0.32, duration: 0.5 } }}
        >
          Rejoignez des équipes qui transforment leurs réunions grâce à l'IA.
        </motion.p>

        <motion.div
          className="auth-brand-features"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { delay: 0.42, duration: 0.5 } }}
        >
          {BRAND_FEATURES.map((f, i) => (
            <motion.div
              key={f}
              className="auth-brand-feature"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0, transition: { delay: 0.44 + i * 0.08, duration: 0.4 } }}
            >
              <span className="feature-dot" />
              {f}
            </motion.div>
          ))}
        </motion.div>
      </div>

      {/* ── Right form panel ── */}
      <div className="auth-form-panel">
        <motion.div
          className="auth-card"
          variants={slideInVariants}
          initial="hidden"
          animate="show"
        >
          <h2>Créer un compte</h2>
          <p className="form-subtitle">Remplissez les informations ci-dessous</p>

          <form onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="nom">Nom complet</label>
              <div className="input-wrapper">
                <User size={15} className="input-icon" />
                <input
                  id="nom"
                  type="text"
                  value={nom}
                  onChange={(e) => setNom(e.target.value)}
                  placeholder="Jean Dupont"
                  required
                  autoComplete="name"
                />
              </div>
            </div>

            <div className="field">
              <label htmlFor="email">Email</label>
              <div className="input-wrapper">
                <Mail size={15} className="input-icon" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="votre@email.com"
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="field">
              <label htmlFor="password">Mot de passe</label>
              <div className="input-wrapper">
                <Lock size={15} className="input-icon" />
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="8 caractères minimum"
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </div>
            </div>

            <motion.button
              type="submit"
              className="btn-submit"
              disabled={loading}
              whileHover={loading ? {} : { scale: 1.02 }}
              whileTap={loading ? {} : { scale: 0.97 }}
            >
              {loading ? (
                <Loader2 size={18} className="spin" />
              ) : (
                <>Créer mon compte <ArrowRight size={17} /></>
              )}
            </motion.button>
          </form>

          <p className="auth-switch">
            Déjà un compte ? <Link to="/login">Se connecter</Link>
          </p>
        </motion.div>
      </div>
    </motion.div>
  );
}
