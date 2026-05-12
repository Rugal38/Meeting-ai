import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronLeft, Mic, Upload, Download, Copy, CheckCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import ThemeToggle from '../components/ThemeToggle';
import { toolsApi } from '../services/api';
import { pageVariants } from '../lib/animations';

export default function AudioToTextPage() {
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ text: string; language: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const ALLOWED = ['audio/'];
  const MAX_SIZE = 500 * 1024 * 1024;

  const validate = (f: File): string | null => {
    if (!ALLOWED.some((t) => f.type.startsWith(t))) return 'Format non supporté. Utilisez un fichier audio (mp3, wav, m4a…).';
    if (f.size > MAX_SIZE) return 'Fichier trop lourd. Maximum 500 MB.';
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
      const { data } = await toolsApi.audioToText(file, setProgress);
      setResult(data);
      toast.success('Transcription terminée !');
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Erreur de transcription. Réessayez.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!result?.text) return;
    navigator.clipboard.writeText(result.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!result?.text) return;
    const blob = new Blob([result.text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${file?.name.replace(/\.[^/.]+$/, '') ?? 'transcription'}.txt`;
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
        <h1 className="tool-title"><Mic size={20} /> Audio → Texte</h1>
        <p className="tool-subtitle">Transcrivez un fichier audio en texte brut. Supports : mp3, wav, m4a, ogg, flac (max 500 MB).</p>
      </div>

      <div className="tool-body">
        {/* Drop zone */}
        <div
          className={`tool-dropzone ${file ? 'tool-dropzone--has-file' : ''}`}
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f); }}
        >
          <input
            ref={fileRef}
            type="file"
            accept="audio/*"
            style={{ display: 'none' }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
          {file ? (
            <div className="tool-file-info">
              <Mic size={28} className="tool-file-icon" />
              <span className="tool-file-name">{file.name}</span>
              <span className="tool-file-size">{(file.size / 1024 / 1024).toFixed(1)} MB</span>
            </div>
          ) : (
            <div className="tool-dropzone-inner">
              <Upload size={32} />
              <span>Glissez un fichier audio ici ou cliquez pour choisir</span>
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
                {progress < 100 ? `Upload ${progress}%…` : 'Transcription en cours…'}
              </>
            ) : (
              <><Mic size={16} /> Lancer la transcription</>
            )}
          </motion.button>
        )}

        {result && (
          <motion.div className="tool-result" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <div className="tool-result-header">
              <span className="tool-result-meta">
                {result.language ? `Langue détectée : ${result.language.toUpperCase()}` : ''}
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
            <div className="tool-result-text">{result.text || 'Aucun texte extrait.'}</div>
            <button className="btn-tool-ghost" onClick={() => { setFile(null); setResult(null); if (fileRef.current) fileRef.current.value = ''; }}>
              Nouveau fichier
            </button>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
