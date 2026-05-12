import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronLeft, FileText, Upload, Download, Copy, CheckCheck, Lock } from 'lucide-react';
import toast from 'react-hot-toast';
import ThemeToggle from '../components/ThemeToggle';
import { toolsApi } from '../services/api';
import type { User } from '../types';
import { pageVariants } from '../lib/animations';

export default function PdfToTextPage() {
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ text: string; page_count: number; remaining_today: number | null } | null>(null);
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState<{ unlimited: boolean; remaining_today: number | null; limit: number | null } | null>(null);
  const [user, setUser] = useState<User | null>(null);

  const MAX_SIZE = 50 * 1024 * 1024;

  useEffect(() => {
    const raw = localStorage.getItem('user');
    if (raw) setUser(JSON.parse(raw) as User);
    toolsApi.pdfToTextStatus().then((r) => setStatus(r.data)).catch(() => {});
  }, []);

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
      const { data } = await toolsApi.pdfToText(file, setProgress);
      setResult(data);
      if (data.remaining_today !== null) {
        setStatus((s) => s ? { ...s, remaining_today: data.remaining_today } : s);
      }
      toast.success('Extraction terminée !');
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 429) {
        toast.error('Limite journalière atteinte. Passez en Pro pour un accès illimité.');
      } else if (status === 422) {
        toast.error('Ce PDF ne contient pas de texte extractible (PDF scanné ?).');
      } else {
        toast.error(err?.response?.data?.detail || "Erreur d'extraction. Réessayez.");
      }
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
    a.download = `${file?.name.replace(/\.pdf$/i, '') ?? 'extraction'}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const isFree = user?.planTier === 'free' || (!user?.planTier);
  const blocked = status && !status.unlimited && (status.remaining_today ?? 0) <= 0;

  return (
    <motion.div className="tool-page" variants={pageVariants} initial="initial" animate="animate" exit="exit">
      <div className="tool-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <motion.button className="btn-back" onClick={() => navigate('/dashboard')} whileHover={{ x: -3 }}>
            <ChevronLeft size={17} /> Retour
          </motion.button>
          <ThemeToggle />
        </div>
        <h1 className="tool-title"><FileText size={20} /> PDF → Texte</h1>
        <p className="tool-subtitle">Extrayez le texte brut d'un PDF en un clic (max 50 MB).</p>
      </div>

      {/* Daily limit banner */}
      {isFree && status && !status.unlimited && (
        <div className={`tool-limit-banner ${blocked ? 'tool-limit-banner--blocked' : ''}`}>
          {blocked ? (
            <><Lock size={14} /> Limite journalière atteinte ({status.limit}/jour pour le plan gratuit). <button className="tool-limit-link" onClick={() => navigate('/billing')}>Passer en Pro →</button></>
          ) : (
            <><FileText size={14} /> Utilisations restantes aujourd'hui : <strong>{status.remaining_today}</strong> / {status.limit}</>
          )}
        </div>
      )}

      <div className="tool-body">
        <div
          className={`tool-dropzone ${file ? 'tool-dropzone--has-file' : ''} ${blocked ? 'tool-dropzone--disabled' : ''}`}
          onClick={() => !blocked && fileRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); if (!blocked) { const f = e.dataTransfer.files?.[0]; if (f) handleFile(f); } }}
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
              <FileText size={28} className="tool-file-icon" />
              <span className="tool-file-name">{file.name}</span>
              <span className="tool-file-size">{(file.size / 1024 / 1024).toFixed(1)} MB</span>
            </div>
          ) : (
            <div className="tool-dropzone-inner">
              <Upload size={32} />
              <span>{blocked ? 'Limite journalière atteinte' : 'Glissez un PDF ici ou cliquez pour choisir'}</span>
            </div>
          )}
        </div>

        {file && !result && !blocked && (
          <motion.button
            className="btn-tool-primary"
            onClick={handleSubmit}
            disabled={loading}
            whileHover={!loading ? { scale: 1.02 } : {}}
          >
            {loading ? (
              <>
                <span className="tool-spinner" />
                {progress < 100 ? `Upload ${progress}%…` : 'Extraction en cours…'}
              </>
            ) : (
              <><FileText size={16} /> Extraire le texte</>
            )}
          </motion.button>
        )}

        {result && (
          <motion.div className="tool-result" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <div className="tool-result-header">
              <span className="tool-result-meta">{result.page_count} page{result.page_count !== 1 ? 's' : ''}</span>
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
