import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ThemeToggle from '../components/ThemeToggle';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, MessageSquare, List, Target, Clock,
  Globe, CheckCircle, Sparkles, Download,
} from 'lucide-react';
import jsPDF from 'jspdf';
import api from '../services/api';
import type { Meeting, Segment } from '../types';
import ProcessingLoader from '../components/ProcessingLoader';
import {
  pageVariants, containerVariants, cardVariants, tabContentVariants,
} from '../lib/animations';

function formatTime(seconds: number | undefined): string {
  if (seconds == null || isNaN(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatDate(iso: string | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

function parseJson<T>(raw: string | undefined, fallback: T): T {
  if (!raw) return fallback;
  try { return JSON.parse(raw) as T; } catch { return fallback; }
}

function downloadTranscriptPDF(meeting: Meeting, segments: Segment[]) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const margin = 20;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const contentW = pageW - margin * 2;
  let y = margin;

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  const titleLines = doc.splitTextToSize(meeting.titre, contentW);
  doc.text(titleLines, margin, y);
  y += titleLines.length * 8 + 2;

  // Metadata
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(120);
  const meta = [
    formatDate(meeting.dateCreation),
    meeting.langue ? meeting.langue.toUpperCase() : null,
    meeting.dureeSecondes > 0 ? formatTime(meeting.dureeSecondes) : null,
  ].filter(Boolean).join('   ·   ');
  doc.text(meta, margin, y);
  y += 6;

  // Divider
  doc.setDrawColor(200);
  doc.line(margin, y, pageW - margin, y);
  y += 8;

  // Transcript body
  const fullText =
    meeting.transcription?.texteComplet ||
    segments.map(s => s.text).join(' ');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(30);
  const lineH = 6.5;

  // Split on existing newlines first to preserve paragraph breaks
  const paragraphs = fullText.split(/\n+/).filter(p => p.trim());
  for (const para of paragraphs) {
    const lines = doc.splitTextToSize(para, contentW);
    for (const line of lines) {
      if (y + lineH > pageH - margin) {
        doc.addPage();
        y = margin;
      }
      doc.text(line, margin, y);
      y += lineH;
    }
    y += 3; // paragraph spacing
  }

  const safeName = meeting.titre.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  doc.save(`${safeName}_transcript.pdf`);
}

function downloadSummaryPDF(meeting: Meeting, pointsCles: string[], conclusions: string[]) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const margin = 20;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const contentW = pageW - margin * 2;
  let y = margin;

  const addPageIfNeeded = (needed: number) => {
    if (y + needed > pageH - margin) { doc.addPage(); y = margin; }
  };

  // ── Title ──
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  const titleLines = doc.splitTextToSize(meeting.titre, contentW);
  doc.text(titleLines, margin, y);
  y += titleLines.length * 9 + 2;

  // ── Metadata ──
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(120);
  const meta = [
    formatDate(meeting.dateCreation),
    meeting.langue ? meeting.langue.toUpperCase() : null,
    meeting.dureeSecondes > 0 ? formatTime(meeting.dureeSecondes) : null,
  ].filter(Boolean).join('   ·   ');
  doc.text(meta, margin, y);
  y += 6;

  doc.setDrawColor(200);
  doc.line(margin, y, pageW - margin, y);
  y += 9;

  const sectionTitle = (label: string) => {
    addPageIfNeeded(12);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(40);
    doc.text(label, margin, y);
    y += 7;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(30);
  };

  // ── Summary ──
  sectionTitle('Résumé global');
  const summaryText = meeting.resume?.texteResume || '';
  const summaryParas = summaryText.split(/\n+/).filter(p => p.trim());
  for (const para of summaryParas) {
    const lines = doc.splitTextToSize(para, contentW);
    for (const line of lines) {
      addPageIfNeeded(6.5);
      doc.text(line, margin, y);
      y += 6.5;
    }
    y += 3;
  }
  y += 4;

  // ── Key points ──
  if (pointsCles.length > 0) {
    sectionTitle('Points clés');
    pointsCles.forEach((pt, i) => {
      const lines = doc.splitTextToSize(`${i + 1}.  ${pt}`, contentW - 4);
      addPageIfNeeded(lines.length * 6.5);
      doc.text(lines, margin, y);
      y += lines.length * 6.5 + 2;
    });
    y += 4;
  }

  // ── Conclusions ──
  if (conclusions.length > 0) {
    sectionTitle('Conclusions');
    conclusions.forEach((c, i) => {
      const lines = doc.splitTextToSize(`${i + 1}.  ${c}`, contentW - 4);
      addPageIfNeeded(lines.length * 6.5);
      doc.text(lines, margin, y);
      y += lines.length * 6.5 + 2;
    });
  }

  const safeName = meeting.titre.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  doc.save(`${safeName}_summary.pdf`);
}

type TabId = 'summary' | 'transcript';

export default function MeetingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('summary');
  const navigate = useNavigate();

  const fetchMeeting = useCallback(async () => {
    try {
      const { data } = await api.get<Meeting>(`/reunions/${id}`);
      setMeeting(data);
    } catch {
      /* handled by interceptor */
    }
  }, [id]);

  useEffect(() => { fetchMeeting(); }, [fetchMeeting]);

  /* Auto-refresh while processing */
  useEffect(() => {
    if (!meeting || meeting.statut === 'TERMINE' || meeting.statut === 'ERREUR') return;
    const interval = setInterval(fetchMeeting, 5_000);
    return () => clearInterval(interval);
  }, [meeting, fetchMeeting]);

  if (!meeting) {
    return (
      <div className="page-loader">
        <div className="loader-ring" />
      </div>
    );
  }

  const segments: Segment[]    = parseJson<Segment[]>(meeting.transcription?.segmentsJson, []);
  const pointsCles: string[]   = parseJson<string[]>(meeting.resume?.pointsCles, []);
  const conclusions: string[]  = parseJson<string[]>(meeting.resume?.conclusions, []);

  return (
    <motion.div
      className="detail-page"
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      {/* ── Header ── */}
      <div className="detail-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <motion.button
            className="btn-back"
            onClick={() => navigate('/dashboard')}
            whileHover={{ x: -3 }}
          >
            <ChevronLeft size={17} /> Retour aux réunions
          </motion.button>
          <ThemeToggle />
        </div>

        <h1 className="detail-title">{meeting.titre}</h1>

        <div className="meta-row">
          {meeting.dureeSecondes != null && meeting.dureeSecondes > 0 && (
            <span className="meta-chip">
              <Clock size={12} /> {formatTime(meeting.dureeSecondes)}
            </span>
          )}
          {meeting.langue && (
            <span className="meta-chip">
              <Globe size={12} /> {meeting.langue.toUpperCase()}
            </span>
          )}
          <span className="meta-chip">
            <Sparkles size={12} /> {formatDate(meeting.dateCreation)}
          </span>
        </div>
      </div>

      {/* ── Processing state ── */}
      {(meeting.statut === 'EN_COURS' || meeting.statut === 'EN_ATTENTE') ? (
        <ProcessingLoader />
      ) : meeting.statut === 'ERREUR' ? (
        <motion.div
          className="content-card"
          style={{ borderColor: 'var(--error-border)', textAlign: 'center', padding: '3rem' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <p style={{ color: 'var(--error)', fontSize: '0.9375rem' }}>
            Une erreur est survenue lors de l'analyse. Réessayez en uploadant à nouveau le fichier.
          </p>
        </motion.div>
      ) : (
        <>
          {/* ── Tab nav ── */}
          <div className="tab-nav">
            {([
              { id: 'summary',    label: 'Résumé & Insights', icon: <Target size={14} /> },
              { id: 'transcript', label: 'Transcription',     icon: <MessageSquare size={14} /> },
            ] as { id: TabId; label: string; icon: React.ReactNode }[]).map((tab) => (
              <button
                key={tab.id}
                className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>

          {/* ── Tab content ── */}
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={activeTab}
              variants={tabContentVariants}
              initial="hidden"
              animate="show"
              exit="exit"
            >
              {activeTab === 'summary' ? (
                <motion.div variants={containerVariants} initial="hidden" animate="show">
                  {/* Summary card */}
                  <motion.div className="content-card" variants={cardVariants}>
                    <h2 className="card-title">
                      <Target size={14} /> Résumé global
                      <button
                        className="btn-download-pdf"
                        onClick={() => downloadSummaryPDF(meeting, pointsCles, conclusions)}
                        title="Télécharger le résumé complet en PDF"
                      >
                        <Download size={13} /> Tout télécharger
                      </button>
                    </h2>
                    <p className="summary-text">
                      {meeting.resume?.texteResume || 'Aucun résumé disponible.'}
                    </p>
                  </motion.div>

                  {/* Insights grid */}
                  <div className="insights-grid">
                    <motion.div className="content-card" variants={cardVariants}>
                      <h2 className="card-title">
                        <List size={14} /> Points clés
                      </h2>
                      {pointsCles.length > 0 ? (
                        <ul className="insight-list">
                          {pointsCles.map((p, i) => (
                            <li key={i} className="insight-item">
                              <span className="insight-number">
                                {String(i + 1).padStart(2, '0')}
                              </span>
                              <span className="insight-text">{p}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="no-content">Aucun point clé détecté.</p>
                      )}
                    </motion.div>

                    <motion.div className="content-card" variants={cardVariants}>
                      <h2 className="card-title">
                        <CheckCircle size={14} /> Conclusions
                      </h2>
                      {conclusions.length > 0 ? (
                        <ul className="insight-list">
                          {conclusions.map((c, i) => (
                            <li key={i} className="insight-item">
                              <span className="insight-number">
                                {String(i + 1).padStart(2, '0')}
                              </span>
                              <span className="insight-text">{c}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="no-content">Aucune conclusion détectée.</p>
                      )}
                    </motion.div>
                  </div>
                </motion.div>
              ) : (
                <motion.div className="content-card" variants={cardVariants}>
                  <h2 className="card-title">
                    <MessageSquare size={14} /> Transcription complète
                    <button
                      className="btn-download-pdf"
                      onClick={() => downloadTranscriptPDF(meeting, segments)}
                      title="Télécharger la transcription en PDF"
                    >
                      <Download size={13} /> PDF
                    </button>
                  </h2>

                  {(() => {
                    const fullText =
                      meeting.transcription?.texteComplet ||
                      (segments.length > 0 ? segments.map(s => s.text).join(' ') : null);

                    if (!fullText) {
                      return <p className="no-content">Transcription non disponible.</p>;
                    }

                    const paragraphs = fullText.split(/\n+/).filter(p => p.trim());
                    return (
                      <div className="transcript-script">
                        {paragraphs.length > 1
                          ? paragraphs.map((para, i) => (
                              <p key={i} className="transcript-para">{para}</p>
                            ))
                          : <p className="transcript-para">{fullText}</p>
                        }
                      </div>
                    );
                  })()}
                </motion.div>
              )}
            </motion.div>
          </AnimatePresence>
        </>
      )}
    </motion.div>
  );
}
