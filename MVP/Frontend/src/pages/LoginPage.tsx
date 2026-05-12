import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, Lock, ArrowRight, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { pageVariants, slideInVariants } from '../lib/animations';

const BRAND_FEATURES = [
  'Transcription automatique FR / EN',
  'Résumé IA & points clés',
  'Historique de toutes vos réunions',
];

/* Heights for the decorative waveform — mimics a real audio waveform shape */
const WAVE_HEIGHTS = [28, 44, 60, 80, 96, 88, 72, 56, 40, 52, 68, 88, 96, 84, 68, 52, 36, 48, 64, 32];

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { email, password });
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data));
      navigate('/dashboard');
    } catch {
      toast.error('Identifiants invalides. Vérifiez votre email et mot de passe.');
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

        {/* Animated waveform visualization */}
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
          Transformez vos réunions<br />en <em>intelligence</em>
        </motion.h1>

        <motion.p
          className="auth-brand-sub"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0, transition: { delay: 0.32, duration: 0.5 } }}
        >
          Transcription automatique, résumé IA, points clés — en quelques minutes.
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
          <h2>Bon retour !</h2>
          <p className="form-subtitle">Connectez-vous à votre compte</p>

          <form onSubmit={handleSubmit}>
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
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
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
                <>Se connecter <ArrowRight size={17} /></>
              )}
            </motion.button>
          </form>

          <p className="auth-switch">
            Pas encore de compte ? <Link to="/signup">S'inscrire</Link>
          </p>
        </motion.div>
      </div>
    </motion.div>
  );
}
