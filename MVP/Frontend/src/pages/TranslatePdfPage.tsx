import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronLeft, Languages, Upload, Download, Copy, CheckCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import ThemeToggle from '../components/ThemeToggle';
import { toolsApi } from '../services/api';
import { pageVariants } from '../lib/animations';

const LANGUAGES = [
  { value: 'en', label: '🇬🇧 Anglais' },
  { value: 'fr', label: '🇫🇷 Français' },
  { value: 'ar', label: '🇸🇦 Arabe' },
];

export default function TranslatePdfPage() {
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [targetLang, setTargetLang] = useState('en');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ translated_text: string; source_language: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const MAX_SIZE = 50 * 1024 * 1024;

  const validate = (f: File): string | null => {
    if (f.type !== 'application/pdf') return 'Format non supporté. Uploadez un fichier PDF.';
    if (f.size > MAX_SIZE) return 'Fichier trop lourd. Maximum 50 MB.';
    return null;
  };

  const handleFile = (f: File) => {
    const err = validate(f);
    if (err) { toast.error(err); return; }
    setFile(f);
    setResult(null);
  };

  const handleSubmit = async () => {
    if (!file) return;
    setLoading(true);
    setProgress(0);
    try {
      const { data } = await toolsApi.translatePdf(file, targetLang, setProgress);
      setResult(data);
      toast.success('Traduction terminée !');
    } catch (err: any) {
      const s = err?.response?.status;
      if (s === 422) toast.error('Ce PDF ne contient pas de texte extractible (PDF scanné ?).');
      else toast.error(err?.response?.data?.detail || 'Erreur de traduction. Réessayez.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!result?.translated_text) return;
    navigator.clipboard.writeText(result.translated_text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!result?.translated_text) return;
    const blob = new Blob([result.translated_text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${file?.name.replace(/\.pdf$/i, '') ?? 'traduction'}_${targetLang}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <motion.div className="tool-page" variants={pageVariants} initial="initial" animate="animate" exit="exit">
      <div className="tool-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <motion.button className="btn-back" onClick={() => navigate('/dashboard')} whileHover={{ x: -3 }}>
            <ChevronLeft size={17} /> Retour
          </motion.button>
          <ThemeToggle />
        </div>
        <h1 className="tool-title"><Languages size={20} /> Traduire un PDF</h1>
        <p className="tool-subtitle">Uploadez un PDF et recevez sa traduction en Anglais, Français ou Arabe (max 50 MB).</p>
      </div>

      <div className="tool-body">
        {/* Language selector */}
        <div className="tool-lang-selector">
          <span className="tool-lang-label">Langue cible :</span>
          <div className="tool-lang-options">
            {LANGUAGES.map((l) => (
              <button
                key={l.value}
                className={`tool-lang-btn ${targetLang === l.value ? 'tool-lang-btn--active' : ''}`}
                onClick={() => setTargetLang(l.value)}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>

        <div
          className={`tool-dropzone ${file ? 'tool-dropzone--has-file' : ''}`}
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f); }}
        >
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf"
            style={{ display: 'none' }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
          {file ? (
            <div className="tool-file-info">
              <Languages size={28} className="tool-file-icon" />
              <span className="tool-file-name">{file.name}</span>
              <span className="tool-file-size">{(file.size / 1024 / 1024).toFixed(1)} MB</span>
            </div>
          ) : (
            <div className="tool-dropzone-inner">
              <Upload size={32} />
              <span>Glissez un PDF ici ou cliquez pour choisir</span>
            </div>
          )}
        </div>

        {file && !result && (
          <motion.button
            className="btn-tool-primary"
            onClick={handleSubmit}
            disabled={loading}
            whileHover={!loading ? { scale: 1.02 } : {}}
          >
            {loading ? (
              <>
                <span className="tool-spinner" />
                {progress < 100 ? `Upload ${progress}%…` : 'Traduction en cours… (peut prendre quelques minutes)'}
              </>
            ) : (
              <><Languages size={16} /> Traduire en {LANGUAGES.find((l) => l.value === targetLang)?.label}</>
            )}
          </motion.button>
        )}

        {result && (
          <motion.div className="tool-result" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <div className="tool-result-header">
              <span className="tool-result-meta">
                Traduit en {LANGUAGES.find((l) => l.value === targetLang)?.label}
              </span>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn-tool-sm" onClick={handleCopy}>
                  {copied ? <><CheckCheck size={13} /> Copié</> : <><Copy size={13} /> Copier</>}
                </button>
                <button className="btn-tool-sm btn-tool-sm--teal" onClick={handleDownload}>
                  <Download size={13} /> .txt
                </button>
              </div>
            </div>
            <div className={`tool-result-text ${targetLang === 'ar' ? 'tool-result-text--rtl' : ''}`}>
              {result.translated_text || 'Aucun texte traduit.'}
            </div>
            <button className="btn-tool-ghost" onClick={() => { setFile(null); setResult(null); if (fileRef.current) fileRef.current.value = ''; }}>
              Nouveau fichier
            </button>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
