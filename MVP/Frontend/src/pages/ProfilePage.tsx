import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronLeft, User, Mail, Lock, Save, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import ThemeToggle from '../components/ThemeToggle';
import { profileApi } from '../services/api';
import type { User as UserType } from '../types';
import { pageVariants } from '../lib/animations';

export default function ProfilePage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<UserType | null>(null);

  const [nom, setNom] = useState('');
  const [email, setEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [loadingInfo, setLoadingInfo] = useState(false);
  const [loadingPwd, setLoadingPwd] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem('user');
    if (!raw) { navigate('/login'); return; }
    const u = JSON.parse(raw) as UserType;
    setUser(u);
    setNom(u.nom ?? '');
    setEmail(u.email ?? '');
  }, [navigate]);

  const handleInfoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nom.trim()) { toast.error('Le nom ne peut pas être vide.'); return; }
    if (!email.trim()) { toast.error("L'email ne peut pas être vide."); return; }

    setLoadingInfo(true);
    try {
      const { data } = await profileApi.update({ nom: nom.trim(), email: email.trim() });
      const updated = { ...user!, nom: data.nom, email: data.email };
      if (data.token) updated.token = data.token;
      localStorage.setItem('user', JSON.stringify(updated));
      if (data.token) localStorage.setItem('token', data.token);
      setUser(updated);
      toast.success('Profil mis à jour.');
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Erreur lors de la mise à jour.');
    } finally {
      setLoadingInfo(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword) { toast.error('Entrez votre mot de passe actuel.'); return; }
    if (newPassword.length < 6) { toast.error('Le nouveau mot de passe doit comporter au moins 6 caractères.'); return; }
    if (newPassword !== confirmPassword) { toast.error('Les mots de passe ne correspondent pas.'); return; }

    setLoadingPwd(true);
    try {
      await profileApi.update({ currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast.success('Mot de passe modifié.');
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Erreur lors du changement de mot de passe.');
    } finally {
      setLoadingPwd(false);
    }
  };

  if (!user) return null;

  return (
    <motion.div className="tool-page" variants={pageVariants} initial="initial" animate="animate" exit="exit">
      <div className="tool-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <motion.button className="btn-back" onClick={() => navigate('/dashboard')} whileHover={{ x: -3 }}>
            <ChevronLeft size={17} /> Retour
          </motion.button>
          <ThemeToggle />
        </div>
        <h1 className="tool-title"><User size={20} /> Mon Profil</h1>
        <p className="tool-subtitle">Modifiez vos informations personnelles et votre mot de passe.</p>
      </div>

      {/* Avatar + plan badge */}
      <div className="profile-avatar-row">
        <div className="profile-avatar">
          {user.nom?.charAt(0).toUpperCase() || user.email.charAt(0).toUpperCase()}
        </div>
        <div>
          <div className="profile-name">{user.nom || user.email}</div>
          <span className={`profile-plan-badge profile-plan-badge--${user.planTier}`}>
            {user.planTier === 'free' ? 'Free' : user.planTier === 'pro' ? 'Pro' : 'Business'}
          </span>
        </div>
      </div>

      {/* Info form */}
      <form className="profile-card" onSubmit={handleInfoSubmit}>
        <h2 className="profile-card-title"><User size={15} /> Informations générales</h2>

        <div className="profile-field">
          <label className="profile-label">Nom</label>
          <div className="profile-input-wrap">
            <User size={15} className="profile-input-icon" />
            <input
              className="profile-input"
              type="text"
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              placeholder="Votre nom"
              autoComplete="name"
            />
          </div>
        </div>

        <div className="profile-field">
          <label className="profile-label">Adresse email</label>
          <div className="profile-input-wrap">
            <Mail size={15} className="profile-input-icon" />
            <input
              className="profile-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="votre@email.com"
              autoComplete="email"
            />
          </div>
          {email !== user.email && (
            <p className="profile-hint">Un nouveau token de session sera émis si l'email change.</p>
          )}
        </div>

        <button className="btn-tool-primary" type="submit" disabled={loadingInfo} style={{ marginTop: '0.5rem' }}>
          {loadingInfo ? <><span className="tool-spinner" /> Enregistrement…</> : <><Save size={15} /> Enregistrer les modifications</>}
        </button>
      </form>

      {/* Password form */}
      <form className="profile-card" onSubmit={handlePasswordSubmit}>
        <h2 className="profile-card-title"><Lock size={15} /> Changer le mot de passe</h2>

        <div className="profile-field">
          <label className="profile-label">Mot de passe actuel</label>
          <div className="profile-input-wrap">
            <Lock size={15} className="profile-input-icon" />
            <input
              className="profile-input"
              type={showCurrent ? 'text' : 'password'}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
            />
            <button type="button" className="profile-eye" onClick={() => setShowCurrent((v) => !v)}>
              {showCurrent ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </div>

        <div className="profile-field">
          <label className="profile-label">Nouveau mot de passe</label>
          <div className="profile-input-wrap">
            <Lock size={15} className="profile-input-icon" />
            <input
              className="profile-input"
              type={showNew ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Minimum 6 caractères"
              autoComplete="new-password"
            />
            <button type="button" className="profile-eye" onClick={() => setShowNew((v) => !v)}>
              {showNew ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </div>

        <div className="profile-field">
          <label className="profile-label">Confirmer le nouveau mot de passe</label>
          <div className="profile-input-wrap">
            <Lock size={15} className="profile-input-icon" />
            <input
              className="profile-input"
              type={showNew ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
            />
          </div>
          {confirmPassword && newPassword !== confirmPassword && (
            <p className="profile-hint profile-hint--error">Les mots de passe ne correspondent pas.</p>
          )}
        </div>

        <button className="btn-tool-primary" type="submit" disabled={loadingPwd} style={{ marginTop: '0.5rem' }}>
          {loadingPwd ? <><span className="tool-spinner" /> Modification…</> : <><Lock size={15} /> Changer le mot de passe</>}
        </button>
      </form>
    </motion.div>
  );
}
