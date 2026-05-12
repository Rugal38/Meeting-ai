import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronLeft, Sparkles, Languages, Mic, Video, FileText, GitMerge, Bell, Users, Search } from 'lucide-react';
import ThemeToggle from '../components/ThemeToggle';
import { pageVariants, containerVariants, cardVariants } from '../lib/animations';

const TOOLS_NOW = [
  { icon: <Mic size={22} />, title: 'Audio → Texte', desc: 'Transcrivez n\'importe quel fichier audio en texte brut, téléchargeable en .txt.', href: '/tools/audio-to-text', badge: 'Disponible' },
  { icon: <Video size={22} />, title: 'Vidéo → Texte', desc: 'Extrayez la transcription complète d\'une vidéo sans passer par l\'analyse IA.', href: '/tools/video-to-text', badge: 'Disponible' },
  { icon: <FileText size={22} />, title: 'PDF → Texte', desc: 'Extrayez le texte brut d\'un PDF en un clic. Gratuit : 3 PDFs par jour.', href: '/tools/pdf-to-text', badge: 'Disponible' },
  { icon: <Languages size={22} />, title: 'Traduire un PDF', desc: 'Uploadez un PDF et obtenez sa traduction en Français, Anglais ou Arabe.', href: '/tools/translate-pdf', badge: 'Disponible' },
];

const COMING_SOON = [
  { icon: <GitMerge size={22} />, title: 'Diarisation des locuteurs', desc: 'Identifiez qui a dit quoi dans vos réunions avec horodatage par locuteur.' },
  { icon: <Bell size={22} />, title: 'Notifications email', desc: 'Recevez un email quand votre analyse est prête ou en cas d\'échec de paiement.' },
  { icon: <Search size={22} />, title: 'Recherche dans les transcriptions', desc: 'Recherche plein texte sur toutes vos réunions passées.' },
  { icon: <Users size={22} />, title: 'Collaboration équipe', desc: 'Partagez vos réunions avec des membres de l\'équipe et gérez les accès.' },
];

export default function NewFeaturesPage() {
  const navigate = useNavigate();

  return (
    <motion.div
      className="tool-page"
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      <div className="tool-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <motion.button className="btn-back" onClick={() => navigate('/dashboard')} whileHover={{ x: -3 }}>
            <ChevronLeft size={17} /> Retour
          </motion.button>
          <ThemeToggle />
        </div>
        <h1 className="tool-title"><Sparkles size={20} /> Nouveautés & Outils</h1>
        <p className="tool-subtitle">Outils disponibles maintenant et fonctionnalités à venir.</p>
      </div>

      <motion.div variants={containerVariants} initial="hidden" animate="show">
        <h2 className="features-section-label">Outils disponibles</h2>
        <div className="features-grid">
          {TOOLS_NOW.map((f) => (
            <motion.div
              key={f.title}
              className="feature-card feature-card--active"
              variants={cardVariants}
              onClick={() => navigate(f.href)}
              style={{ cursor: 'pointer' }}
              whileHover={{ y: -3 }}
            >
              <div className="feature-icon">{f.icon}</div>
              <div className="feature-body">
                <div className="feature-card-top">
                  <h3>{f.title}</h3>
                  <span className="feature-badge feature-badge--live">{f.badge}</span>
                </div>
                <p>{f.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>

        <h2 className="features-section-label" style={{ marginTop: '2rem' }}>À venir</h2>
        <div className="features-grid">
          {COMING_SOON.map((f) => (
            <motion.div key={f.title} className="feature-card feature-card--soon" variants={cardVariants}>
              <div className="feature-icon feature-icon--dim">{f.icon}</div>
              <div className="feature-body">
                <div className="feature-card-top">
                  <h3>{f.title}</h3>
                  <span className="feature-badge feature-badge--soon">Bientôt</span>
                </div>
                <p>{f.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}
