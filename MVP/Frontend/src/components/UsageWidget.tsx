import { useEffect, useState } from 'react';
import { usageApi } from '../services/api';
import type { UsageData } from '../types';

function ProgressBar({ value, max }: { value: number; max: number | null }) {
  if (max === null) {
    return (
      <div className="usage-bar-track">
        <div className="usage-bar-fill unlimited" />
      </div>
    );
  }
  const pct = Math.min((value / max) * 100, 100);
  const cls = pct >= 100 ? 'over' : pct >= 80 ? 'warn' : '';
  return (
    <div className="usage-bar-track">
      <div className="usage-bar-fill" style={{ width: `${pct}%` }} data-state={cls} />
    </div>
  );
}

function fmt(n: number) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

export default function UsageWidget() {
  const [usage, setUsage] = useState<UsageData | null>(null);

  useEffect(() => {
    usageApi.get().then((r) => setUsage(r.data)).catch(() => {});
  }, []);

  if (!usage) return null;

  const { limits, transcriptionMinutesUsed, summariesGenerated, planTier } = usage;

  return (
    <div className="usage-widget">
      <div className="usage-widget-title">
        Utilisation
        <span className={`plan-badge plan-badge-${planTier}`}>{planTier.toUpperCase()}</span>
      </div>

      <div className="usage-row">
        <div className="usage-label">
          <span>Transcription</span>
          <span className="usage-count">
            {limits.transcriptionMinutes === null
              ? 'Illimité'
              : `${fmt(transcriptionMinutesUsed)} / ${limits.transcriptionMinutes} min`}
          </span>
        </div>
        <ProgressBar value={transcriptionMinutesUsed} max={limits.transcriptionMinutes} />
      </div>

      <div className="usage-row">
        <div className="usage-label">
          <span>Résumés</span>
          <span className="usage-count">
            {limits.summaries === null
              ? 'Illimité'
              : `${summariesGenerated} / ${limits.summaries}`}
          </span>
        </div>
        <ProgressBar value={summariesGenerated} max={limits.summaries} />
      </div>

      {planTier === 'free' && (
        <a href="/billing" className="usage-upgrade-link">
          Passer à Pro →
        </a>
      )}
    </div>
  );
}
