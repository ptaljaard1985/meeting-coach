export const EXAMPLE_MODEL = 'gpt-6.1-sol';
export const EXAMPLE_PROMPT_VERSION = 'meeting-coach-example-1.0';
export const EXAMPLE_OUTPUT_TOKENS = 20_000;
export const SCENARIOS = {
  retirement: 'A couple considering a gradual retirement while balancing time together, work identity and uneven confidence about money.',
  education: 'A couple balancing school costs, an uncertain household budget and different priorities about time with their children.',
  career: 'A couple discussing a career change and a temporary fall in income, with different feelings about security and meaningful work.',
  family: 'A couple making room to support an older relative while protecting their own plans and discussing practical limits.',
  business: 'A couple with irregular self-employed income planning more stability and disagreeing gently about how much flexibility they need.',
  relocation: 'A couple considering a move and reduced working hours, with different views about community, family and the cost of change.',
} as const;
export type ScenarioId = keyof typeof SCENARIOS;

export const EXAMPLE_INSTRUCTIONS = `You write fictional, realistic financial-adviser meeting transcripts for testing Meeting Coach.
This is synthetic test data, never an actual client record or a recommendation to a real person.

LENGTH AND FORMAT
- Write the complete conversation, not a summary, outline, scene description or excerpt.
- The speech must total 6,300–7,700 whitespace-separated words: approximately 45–55 minutes at 140 spoken words per minute. Aim for 6,900–7,200 words.
- Use 80–150 naturally varied speech turns. Short answers can be a few words; occasional explanations may be longer. Do not make every turn the same length.
- Return only JSON conforming to the supplied schema: a short title and segments with speaker and text.
- Use exactly the labels Adviser, Client A, Client B. The clients are a couple. Both must speak substantially and have distinct priorities and conversational voices.
- The application will assign clearly synthetic, word-based timestamps. Do not output timestamps or pretend a real recording exists.
- Keep the complete transcript under approximately 55,000 characters. Use ordinary, concise vocabulary so it fits the tool's input limit.

FRESH CASE
- Follow the server-supplied scenario and variation. Invent a new coherent household story, concerns, sequence of discussion and action list for this request.
- Treat the variation ID as a creativity seed, not as dialogue to repeat. Do not recycle a generic script.
- Use British English. All people, employers, providers, circumstances and amounts must be fictional. Use generic speaker labels instead of personal names.
- Do not include emails, phone numbers, physical addresses, account numbers, ID numbers or actual client information.
- Avoid identifying real financial firms. Any financial discussion is illustrative conversation, not a product recommendation or claim of legal or tax correctness.

NATURAL CONVERSATION
- Give the meeting an opening check-in, a negotiated agenda, substantive exploration and explanation, at least one decision or agreed next step, and a proper close with client responses.
- Include plausible life events, specific goals and feelings. Let one client's priority differ from the other's without manufacturing hostility.
- Include follow-up questions, reflections, clarifications, pauses represented by ordinary speech, mild interruptions and occasional digressions. Avoid theatrical dialogue and wall-to-wall monologues.
- Let clients correct or qualify the adviser's understanding at least once. Let one goal change or become clearer during the meeting.
- Keep details internally consistent across the full meeting; do not silently change ages, goals, amounts or responsibilities.
- No padding, repeated passages, invented inaudible stage directions or repeated summaries to meet the word count.

MEETING CRAFT TO EXERCISE
Naturally include opportunities relevant to all seven sections: opening engagement and a client-shaped agenda; listening and reflections; responding to worry and discussing a possible difficult period; explaining technical terms and checking understanding; confirming decisions, action owners, timing and obstacles; linking discussion to client-stated goals; inviting each partner and hearing each person's confirmation.
The adviser should have a believable mix of strengths and missed opportunities. Follow the supplied variation emphasis. Do not make the meeting uniformly excellent or deliberately terrible. Do not explain the rubric, label behaviours, predict scores, or insert coaching commentary into the transcript. Some opportunities can be missed or only partly handled so the reviewer has something useful to assess.
The two clients are people, not prompts that conveniently demonstrate each scoring criterion.

BEFORE RETURNING
Check that the full conversation contains enough actual speech, all three distinct speakers, a visible close and consistent story details. A short transcript with a 50-minute label does not meet the requirement.`;
