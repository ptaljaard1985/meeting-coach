// Port of supplied metrics.ts. Timestamp gaps are calculated on the FULL timeline.
// Observer speech breaks runs; it is never reassigned to adviser/client time.
import type { MeetingMetrics, Segment, SpeakerRole, MeetingContext } from './types';
import { parseTimestamp } from './transcripts';
const WORDS_PER_MINUTE = 140;
const GENERIC_SPEAKER = /^speaker\s*\d+$/i;
const MIN_RELIABLE_ADVISER_UTTERANCE_SHARE = 0.1;
interface MetricsInput { segments: Segment[]; roles: SpeakerRole[]; context: MeetingContext; knownDurationSeconds?: number }
const EMPTY_METRICS: MeetingMetrics = {
 talk_share_adviser:null,question_count_adviser:0,longest_adviser_monologue_s:null,longest_client_monologue_s:null,
 client_balance_ratio:null,duration_min:null,diarised:false,basis:'words',duration_is_estimate:true,spans_are_estimates:true,
 speakers:{adviser:[],client:[],observer:[]},client_shares:[]
};
export function countWords(text: string | null | undefined): number {
  if (typeof text !== 'string') return 0
  const trimmed = text.trim()
  return trimmed === '' ? 0 : trimmed.split(/\s+/).length
}

function wordsToSeconds(words: number): number {
  return (words / WORDS_PER_MINUTE) * 60
}

function round(value: number, dp: number): number {
  const f = 10 ** dp
  return Math.round(value * f) / f
}

/**
 * Compute the metrics for one transcript.
 *
 * `basis` is 'timestamps' only when every utterance carries a parseable, non-decreasing
 * timestamp; otherwise the whole computation falls back to word counts so a single bad
 * timestamp can't silently skew half the figures against the other half.
 */
export function computeMeetingMetrics({
  segments,
  roles,
  context,
  knownDurationSeconds,
}: MetricsInput): MeetingMetrics {
  const usable = (segments ?? []).filter((s) => s && typeof s.text === 'string')
  if (usable.length === 0) return { ...EMPTY_METRICS }

  const adviserSet = new Set(roles.filter(r => r.role === "adviser").map(r => r.speaker.trim().toLowerCase()))
  const speakerOf = (s: Segment) => (s.speaker?.display_name ?? '').trim()
  const isAdviser = (s: Segment) => adviserSet.has(speakerOf(s).toLowerCase())

  const distinctSpeakers = [...new Set(usable.map(speakerOf).filter((n) => n !== ''))]
  const adviserSpeakers = distinctSpeakers.filter((n) => adviserSet.has(n.toLowerCase()))
  const clientSet = new Set(roles.filter(r => r.role === 'client').map(r => r.speaker));
  const clientSpeakers = distinctSpeakers.filter(n => clientSet.has(n));
  const observerSpeakers = distinctSpeakers.filter(n => !adviserSet.has(n.toLowerCase()) && !clientSet.has(n));

  // A transcript is diarised when speech can actually be attributed: more than one named
  // speaker, AND the adviser's label looks like a measurement rather than a stray tag.
  // Partial diarisation is the dangerous case — it yields a confident, wrong talk share
  // instead of an obviously missing one. Plan §7 requires the judge be told the metrics
  // are unavailable rather than left to eyeball talk share from the text.
  const adviserUtterances = usable.filter(isAdviser).length
  const hasGenericLabel = distinctSpeakers.some((n) => GENERIC_SPEAKER.test(n))
  const attributionReliable =
    !hasGenericLabel ||
    adviserUtterances / usable.length >= MIN_RELIABLE_ADVISER_UTTERANCE_SHARE
  const diarised = distinctSpeakers.length >= 2 && attributionReliable && adviserSpeakers.length === 1 && clientSpeakers.length > 0

  const stamps = usable.map((s) => parseTimestamp(s.timestamp))
  const monotonic = stamps.every(
    (t, i) => t !== null && (i === 0 || (stamps[i - 1] as number) <= t),
  )
  const basis: 'timestamps' | 'words' = monotonic ? 'timestamps' : 'words'

  // Per-utterance duration in seconds. On the timestamp basis this is the gap to the
  // next utterance; the last one has no successor, so it is estimated from its words.
  // A zero-length gap (two utterances stamped in the same second) also falls back to
  // the word estimate rather than recording a silent turn.
  const durations = usable.map((seg, i) => {
    const words = countWords(seg.text)
    if (basis === 'words') return wordsToSeconds(words)
    if (i === usable.length - 1) {
      // The final utterance has no successor to measure against. When the meeting's true
      // length is known it runs to the end; otherwise its length is estimated from its
      // words, which is the one part of the timeline that is not measured.
      if (knownDurationSeconds !== undefined) {
        const tail = knownDurationSeconds - (stamps[i] as number)
        if (Number.isFinite(tail) && tail > 0) return tail
      }
      return wordsToSeconds(words)
    }
    const gap = (stamps[i + 1] as number) - (stamps[i] as number)
    return gap > 0 ? gap : wordsToSeconds(words)
  })

  const totalSeconds = durations.reduce((a, b) => a + b, 0)

  let adviserSeconds = 0
  const clientSecondsBySpeaker = new Map<string, number>()
  for (const [i, seg] of usable.entries()) {
    if (isAdviser(seg)) {
      adviserSeconds += durations[i]
    } else if (clientSet.has(speakerOf(seg))) {
      const name = speakerOf(seg)
      clientSecondsBySpeaker.set(name, (clientSecondsBySpeaker.get(name) ?? 0) + durations[i])
    }
  }

  // Talk share is only meaningful once speech is reliably attributable and we can tell
  // which speaker is the adviser. Anything derived from attribution stays null otherwise,
  // so no consumer can render a figure the transcript does not actually support.
  const participantSeconds = adviserSeconds + [...clientSecondsBySpeaker.values()].reduce((a,b) => a+b,0);
  const talkShareKnown = diarised && adviserSpeakers.length > 0 && totalSeconds > 0
  const talk_share_adviser = talkShareKnown ? round(adviserSeconds / participantSeconds, 4) : null

  // Longest uninterrupted span: consecutive utterances by the same speaker.
  let longestAdviser = 0
  let longestClient = 0
  let runSeconds = 0
  let runSpeaker: string | null = null
  let runIsAdviser = false
  const closeRun = () => {
    if (runSpeaker === null) return
    if (runIsAdviser) longestAdviser = Math.max(longestAdviser, runSeconds)
    else if (clientSet.has(runSpeaker)) longestClient = Math.max(longestClient, runSeconds)
  }
  for (const [i, seg] of usable.entries()) {
    const name = speakerOf(seg)
    if (name !== runSpeaker) {
      closeRun()
      runSpeaker = name
      runIsAdviser = isAdviser(seg)
      runSeconds = 0
    }
    runSeconds += durations[i]
  }
  closeRun()

  // Plan §7: "adviser utterances ending in ?". Deliberately crude — a consistent
  // definition matters more than a clever one, because this feeds a trend line.
  const question_count_adviser = usable.filter(
    (s) => isAdviser(s) && s.text.trim().endsWith('?'),
  ).length

  const client_shares = [...clientSecondsBySpeaker.entries()]
    .map(([speaker, secs]) => ({ speaker, share: participantSeconds > 0 ? round(secs / participantSeconds, 4) : 0 }))
    .sort((a, b) => b.share - a.share)

  // Couples only. Null when there is one client, or when a client never spoke at all —
  // the ratio would not be finite. client_shares still shows the silence.
  // Computed from raw seconds, not the rounded shares, so the ratio carries no
  // rounding artefact from the display values.
  let client_balance_ratio: number | null = null
  if (context === 'couple' && client_shares.length === 2) {
    const secs = [...clientSecondsBySpeaker.values()].sort((a, b) => b - a)
    const smallest = secs[secs.length - 1]
    if (smallest > 0) client_balance_ratio = round(secs[0] / smallest, 2)
  }

  const knownMinutes =
    typeof knownDurationSeconds === 'number' && Number.isFinite(knownDurationSeconds) && knownDurationSeconds > 0
      ? round(knownDurationSeconds / 60, 1)
      : null

  const derivedDuration =
    basis === 'timestamps'
      ? round(
          ((stamps[usable.length - 1] as number) +
            durations[usable.length - 1] -
            (stamps[0] as number)) /
            60,
          1,
        )
      : round(totalSeconds / 60, 1)

  const duration_min = knownMinutes ?? derivedDuration

  return {
    talk_share_adviser,
    question_count_adviser,
    longest_adviser_monologue_s:
      diarised && adviserSpeakers.length > 0 ? round(longestAdviser, 1) : null,
    longest_client_monologue_s:
      diarised && clientSpeakers.length > 0 ? round(longestClient, 1) : null,
    client_balance_ratio: diarised ? client_balance_ratio : null,
    duration_min,
    diarised,
    basis,
    duration_is_estimate: knownMinutes === null,
    spans_are_estimates: true,
    speakers: { adviser: adviserSpeakers, client: clientSpeakers, observer: observerSpeakers },
    client_shares: diarised ? client_shares : [],
  }
}
