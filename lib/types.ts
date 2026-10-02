export interface Segment { id: string; speaker: { display_name: string }; text: string; timestamp: string }
export type Role = 'adviser' | 'client' | 'observer';
export type MeetingContext = 'single' | 'couple' | 'other';
export interface SpeakerRole { speaker: string; role: Role }
export interface MeetingMetrics {
  talk_share_adviser: number | null; question_count_adviser: number;
  longest_adviser_monologue_s: number | null; longest_client_monologue_s: number | null;
  client_balance_ratio: number | null; duration_min: number | null; diarised: boolean;
  basis: 'words' | 'timestamps'; duration_is_estimate: boolean;
  spans_are_estimates: boolean; speakers: { adviser: string[]; client: string[]; observer: string[] };
  client_shares: { speaker: string; share: number }[];
}
export interface Evidence { segment_id: string; quote: string; speaker: string; timestamp: string }
export type Verdict = 'met' | 'partially_met' | 'not_met' | 'not_assessable';
export interface CriterionResult { criterion_id: string; verdict: Verdict; evidence: Evidence[]; rationale: string }
export interface ScoreResult { score_id: string; assessable: boolean; value: number | null; summary: string; criteria: CriterionResult[] }
export interface Takeaway { title: string; learning: string; example: string }
export interface Review {
  scores: ScoreResult[]; coaching: Takeaway[]; overall: number | null; confidence: 'high' | 'medium' | 'low';
  metrics: MeetingMetrics; model: string; promptVersion: string; rubricVersion: string;
  generatedAt: string; reportId: string; demo: boolean;
}
