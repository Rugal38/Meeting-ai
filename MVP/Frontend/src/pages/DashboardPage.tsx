import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText, Clock, LogOut, Plus, Upload,
  CreditCard, Shield, Music, Film, File,
  Sparkles, Mic, Video, Languages, UserCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import type { Meeting, User } from '../types';
import UsageWidget from '../components/UsageWidget';
import ThemeToggle from '../components/ThemeToggle';
import {
  pageVariants, containerVariants, cardVariants, fadeInVariants,
} from '../lib/animations';

const ALLOWED_TYPES = ['audio/', 'video/', 'application/pdf', 'text/plain'];
const MAX_SIZE_BYTES     = 500 * 1024 * 1024;
const MAX_PDF_SIZE_BYTES = 50  * 1024 * 1024;

const EMPTY_WAVE_HEIGHTS = [20, 36, 52, 68, 80, 68, 52, 36, 20, 28, 44, 60];

function validateFile(file: File): string | null {
  const isPdf = file.type === 'application/pdf';
  if (!ALLOWED_TYPES.some((t) => file.type.startsWith(t))) {
    return 'Format non supporté. Utilisez un fichier audio, vidéo, PDF ou texte.';
  }
  const maxSize = isPdf ? MAX_PDF_SIZE_BYTES : MAX_SIZE_BYTES;
  const maxLabel = isPdf ? '50 MB' : '500 MB';
  if (file.size > maxSize) return `Fichier trop lourd. Maximum ${maxLabel} pour ce type.`;
  return null;
}

function FileKindIcon({ kind }: { kind?: string }) {
  if (kind === 'video') return <Film size={12} />;
  if (kind === 'pdf')   return <File size={12} />;
  if (kind === 'audio') return <Music size={12} />;
  return <FileText size={12} />;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    TERMINE:    { label: 'Terminé',    cls: 'termine' },
    EN_COURS:   { label: 'En cours',   cls: 'en_cours' },
    EN_ATTENTE: { label: 'En attente', cls: 'en_attente' },
    ERREUR:     { label: 'Erreur',     cls: 'erreur' },
  };
  const { label, cls } = map[status] ?? map['EN_ATTENTE'];
  return (
    <span className={`status-badge ${cls}`}>
      <span className="status-dot" />
      {label}
    </span>
  );
}

export default function DashboardPage() {
  const [meetings, setMeetings]           = useState<Meeting[]>([]);
  const [isUploading, setIsUploading]     = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDragging, setIsDragging]       = useState(false);
  const [user, setUser]                   = useState<User | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const fetchMeetings = useCallback(async () => {
    try {
      const { data } = await api.get<Meeting[]>('/reunions');
      setMeetings(data);
    } catch {
      /* silently handled by api interceptor */
    }
  }, []);

  useEffect(() => {
    const raw = localStorage.getItem('user');
    if (!raw) { navigate('/login'); return; }
    setUser(JSON.parse(raw) as User);
    fetchMeetings();
    const interval = setInterval(fetchMeetings, 10_000);
    return () => clearInterval(interval);
  }, [fetchMeetings, navigate]);

  const uploadFile = async (file: File) => {
    const error = validateFile(file);
    if (error) { toast.error(error); return; }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('titre', file.name.replace(/\.[^/.]+$/, ''));

    setIsUploading(true);
    setUploadProgress(0);

    try {
      await api.post('/reunions/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (evt) => {
          setUploadProgress(Math.round((evt.loaded * 100) / (evt.total ?? 1)));
        },
      });
      toast.success('Fichier uploadé — analyse en cours !');
      await fetchMeetings();
    } catch (err: any) {
      if (err?.response?.status === 402) {
        const detail = err.response.data?.detail;
        const msg = typeof detail === 'object' ? detail.message : detail;
        toast.error(msg || 'Limite dépassée. Passez à un plan supérieur.');
      } else {
        toast.error("Erreur lors de l'upload. Réessayez.");
      }
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) uploadFile(file);
  };

  const handleLogout = () => {
    localStorage.clear();
    navigate('/login');
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <motion.div
      className="dashboard-layout"
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      {/* Drag-over overlay */}
      <AnimatePresence>
        {isDragging && (
          <motion.div
            className="drop-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="drop-overlay-inner">
              <Upload size={36} />
              <span>Déposer le fichier ici</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Sidebar ── */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="ai-wave sidebar-logo-icon">
            {[12, 20, 28, 20, 12].map((h, i) => (
              <span
                key={i}
                className="ai-wave-bar"
                style={{ height: h, '--i-delay': `${i * 0.14}s` } as React.CSSProperties}
              />
            ))}
          </div>
          <span className="sidebar-logo-text">MeetingAI</span>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-item active">
            <FileText size={16} /> Mes Réunions
          </div>
          <div className="nav-item" onClick={() => navigate('/billing')} style={{ cursor: 'pointer' }}>
            <CreditCard size={16} /> Facturation
          </div>
          {user?.role === 'admin' && (
            <div className="nav-item" onClick={() => navigate('/admin')} style={{ cursor: 'pointer' }}>
              <Shield size={16} /> Administration
            </div>
          )}

          <div className="nav-item" onClick={() => navigate('/profile')} style={{ cursor: 'pointer' }}>
            <UserCircle size={16} /> Mon Profil
          </div>

          <div className="nav-section-label">Outils</div>
          <div className="nav-item" onClick={() => navigate('/tools/new-features')} style={{ cursor: 'pointer' }}>
            <Sparkles size={16} /> Nouveautés
          </div>
          <div className="nav-item" onClick={() => navigate('/tools/audio-to-text')} style={{ cursor: 'pointer' }}>
            <Mic size={16} /> Audio → Texte
          </div>
          <div className="nav-item" onClick={() => navigate('/tools/video-to-text')} style={{ cursor: 'pointer' }}>
            <Video size={16} /> Vidéo → Texte
          </div>
          <div className="nav-item" onClick={() => navigate('/tools/pdf-to-text')} style={{ cursor: 'pointer' }}>
            <File size={16} /> PDF → Texte
          </div>
          <div className="nav-item" onClick={() => navigate('/tools/translate-pdf')} style={{ cursor: 'pointer' }}>
            <Languages size={16} /> Traduire PDF
          </div>
        </nav>

        {/* Usage widget */}
        <div className="sidebar-usage">
          <UsageWidget />
        </div>

        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-avatar">{user?.nom?.charAt(0)?.toUpperCase()}</div>
            <div style={{ overflow: 'hidden' }}>
              <div className="user-name">{user?.nom}</div>
              <div className="user-email">{user?.email}</div>
            </div>
            <ThemeToggle />
          </div>
          <motion.button
            className="btn-logout"
            onClick={handleLogout}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
          >
            <LogOut size={14} /> Déconnexion
          </motion.button>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="main-content">
        <div className="content-wrapper">
          {/* Header */}
          <div className="content-header">
            <div>
              <h1 className="page-title">Mes Réunions</h1>
              <p className="page-subtitle">
                {meetings.length} réunion{meetings.length !== 1 ? 's' : ''}
              </p>
            </div>
            <motion.label
              className="btn-new"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              style={{ cursor: 'pointer' }}
            >
              <Plus size={16} /> Nouvelle Réunion
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileChange}
                hidden
                accept="audio/*,video/*,application/pdf,.pdf,.txt,text/plain"
              />
            </motion.label>
          </div>

          {/* Upload progress banner */}
          <AnimatePresence>
            {isUploading && (
              <motion.div
                className="upload-banner"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <div className="upload-info">
                  <Upload size={14} />
                  <span>Upload en cours…</span>
                  <span className="upload-percent">{uploadProgress}%</span>
                </div>
                <div className="progress-track">
                  <motion.div
                    className="progress-fill"
                    animate={{ width: `${uploadProgress}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Grid */}
          <motion.div
            className="meetings-grid"
            variants={containerVariants}
            initial="hidden"
            animate="show"
          >
            {meetings.length === 0 ? (
              <motion.div className="empty-state" variants={fadeInVariants}>
                <div className="empty-wave ai-wave">
                  {EMPTY_WAVE_HEIGHTS.map((h, i) => (
                    <span
                      key={i}
                      className="ai-wave-bar"
                      style={{ height: h, '--i-delay': `${i * 0.08}s` } as React.CSSProperties}
                    />
                  ))}
                </div>
                <h3>Aucune réunion pour le moment</h3>
                <p>Uploadez un fichier audio, vidéo ou PDF pour commencer.</p>
              </motion.div>
            ) : (
              meetings.map((m) => (
                <motion.div
                  key={m.id}
                  className="meeting-card"
                  variants={cardVariants}
                  whileHover={{ y: -4, transition: { duration: 0.2 } }}
                  onClick={() => navigate(`/meeting/${m.id}`)}
                >
                  <div className="card-top">
                    <StatusBadge status={m.statut} />
                    {m.langue && m.langue !== 'pdf' && (
                      <span className="lang-tag">{m.langue.toUpperCase()}</span>
                    )}
                    {m.fileRecord?.fileKind && (
                      <span className="kind-tag">
                        <FileKindIcon kind={m.fileRecord.fileKind} />
                        {m.fileRecord.fileKind.toUpperCase()}
                      </span>
                    )}
                  </div>

                  <p className="meeting-title">{m.titre}</p>

                  <div className="meeting-meta">
                    <span className="meta-item">
                      <Clock size={12} />
                      {formatDate(m.dateCreation)}
                    </span>
                    {m.fileRecord?.pageCount && (
                      <span className="meta-item">
                        {m.fileRecord.pageCount} pages
                      </span>
                    )}
                  </div>
                </motion.div>
              ))
            )}
          </motion.div>
        </div>
      </main>
    </motion.div>
  );
}
