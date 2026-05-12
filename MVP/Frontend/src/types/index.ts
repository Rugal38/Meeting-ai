export type MeetingStatus = 'EN_ATTENTE' | 'EN_COURS' | 'TERMINE' | 'ERREUR';
export type PlanTier = 'free' | 'pro' | 'business';
export type UserRole = 'user' | 'admin';
export type SubscriptionStatus = 'active' | 'past_due' | 'canceled' | 'trialing';

export interface Meeting {
  id: number;
  titre: string;
  statut: MeetingStatus;
  dateCreation: string;
  langue: string;
  dureeSecondes: number;
  transcription?: Transcription;
  resume?: Resume;
  fileRecord?: FileRecord;
}

export interface FileRecord {
  fileKind?: 'audio' | 'video' | 'pdf' | 'text';
  pageCount?: number;
}

export interface Transcription {
  texteComplet: string;
  segmentsJson: string;
}

export interface Resume {
  texteResume: string;
  pointsCles: string;
  conclusions: string;
}

export interface Segment {
  start: number;
  end: number;
  text: string;
  language?: string;
}

export interface User {
  id?: number;
  nom: string;
  email: string;
  token: string;
  role: UserRole;
  planTier: PlanTier;
}

// ── Billing ──────────────────────────────────────────────────────────────────

export interface BillingStatus {
  planTier: PlanTier;
  subscriptionStatus: SubscriptionStatus;
  currentPeriodEnd: string | null;
  hasStripeCustomer: boolean;
}

export interface UsageData {
  transcriptionMinutesUsed: number;
  summariesGenerated: number;
  periodStart: string;
  periodEnd: string;
  planTier: PlanTier;
  limits: {
    transcriptionMinutes: number | null;
    summaries: number | null;
  };
}

// ── Admin ─────────────────────────────────────────────────────────────────────

export interface AdminStats {
  totalUsers: number;
  mrr: number;
  subscriptionsByPlan: Record<PlanTier, number>;
  activeJobs: number;
  failedJobs24h: number;
}

export interface AdminUser {
  id: number;
  email: string;
  nom?: string;
  role: UserRole;
  planTier: PlanTier;
  subscriptionStatus: SubscriptionStatus;
  dateCreation: string;
  deletedAt?: string;
  usage?: {
    transcriptionMinutesUsed: number;
    summariesGenerated: number;
    periodStart: string;
    periodEnd: string;
  };
}

export interface AdminJob {
  id: number;
  meetingId: number;
  meetingTitre?: string;
  userEmail?: string;
  statut: MeetingStatus;
  dateCreation: string;
  dateFin?: string;
}
