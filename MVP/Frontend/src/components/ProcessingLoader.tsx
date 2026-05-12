import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, Coffee } from 'lucide-react';

const MESSAGES = [
  "Réveil de l'IA…",
  'Écoute attentive de votre réunion…',
  "L'IA prend des notes (mieux qu'un stagiaire)…",
  'Extraction de la sagesse collective…',
  'Résumé en cours de concoction…',
  'Nettoyage des "euh" et des "ah"…',
  'Distillation des insights les plus brillants…',
  'Presque fini ! Juste un instant…',
];

const WAVE_BARS = 12;

export default function ProcessingLoader() {
  const [msgIndex, setMsgIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setMsgIndex((prev) => (prev + 1) % MESSAGES.length);
    }, 3200);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="processing-container">
      {/* Orbiting pulse rings + brain icon */}
      <div className="processing-orb">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="orb-ring"
            animate={{ scale: [1, 1.8 + i * 0.3], opacity: [0.5, 0] }}
            transition={{
              duration: 2.5,
              delay: i * 0.8,
              repeat: Infinity,
              ease: 'easeOut',
            }}
          />
        ))}
        <div className="orb-core">
          <motion.div
            animate={{ rotate: [0, 5, -5, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          >
            <Brain size={24} />
          </motion.div>
        </div>
      </div>

      {/* Title */}
      <p className="processing-title">Analyse intelligente en cours</p>

      {/* Rotating message */}
      <AnimatePresence mode="wait">
        <motion.p
          key={msgIndex}
          className="processing-message"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.35 }}
        >
          {MESSAGES[msgIndex]}
        </motion.p>
      </AnimatePresence>

      {/* Gold/teal alternating waveform */}
      <div className="waveform">
        {Array.from({ length: WAVE_BARS }).map((_, i) => (
          <motion.div
            key={i}
            className="wave-bar"
            animate={{ height: ['6px', '34px', '6px'] }}
            transition={{
              duration: 1.1,
              delay: i * 0.09,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
            style={{ height: '6px' }}
          />
        ))}
      </div>

      {/* Footer */}
      <p className="processing-footer">
        <Coffee size={13} /> Prenez un café, on s'occupe de tout.
      </p>
    </div>
  );
}
