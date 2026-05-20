/**
 * HYPER-REASONING ENGINE (RM-OS) v1.0
 * Multi-pass deep reasoning for the ARCHITECT feature.
 * Uses _callWithThinking directly to avoid circular dependency with claudeService.chat.
 */
import projectDNA from './projectDNA.json';
import { supabase } from './supabase';

// 3-pass pipeline: Developer → Security → CEO. Enough depth without 30 API calls.
const PASSES = [
  { role: 'ELITE_DEVELOPER',                  label: 'Code & logic optimisation' },
  { role: 'ADVERSARIAL_SECURITY_HACKER',      label: 'Attack surface & vulnerability scan' },
  { role: 'CEO_STRATEGIST_WITH_MORAL_COMPASS', label: 'Strategic alignment & ethics' },
];

async function _callGateway(params) {
  const { data, error } = await supabase.functions.invoke('ai-gateway', { body: params });
  if (error) throw error;
  return data;
}

export const HyperReasoning = {

  async initiateDeepThought(instruction) {
    let thought = {
      proposal: instruction,
      logic_chain: [],
      security_vulnerabilities: [],
      performance_score: 0,
    };

    for (let i = 0; i < PASSES.length; i++) {
      const pass = PASSES[i];
      const prompt = `[ARCHITECT PASS ${i + 1}/${PASSES.length} — ${pass.role}]
TASK: ${pass.label}

CURRENT PROPOSAL:
${typeof thought.proposal === 'string' ? thought.proposal : JSON.stringify(thought.proposal)}

DNA WEIGHTS: ${JSON.stringify(projectDNA.neural_weights)}

${i === PASSES.length - 1 ? 'FINAL PASS: Consolidate all findings into a clean, actionable response for the CEO.' : 'Critique and improve the proposal from your role\'s perspective. Be specific.'}

Return a JSON object:
{
  "proposal": "improved proposal or final answer",
  "findings": "what you changed or validated",
  "security_vulnerabilities": ["any issues found — empty array if none"],
  "performance_score": 0-100
}`;

      try {
        const response = await _callGateway({
          model: 'claude-sonnet-4-6',
          max_tokens: 8192,
          thinking: { type: 'enabled', budget_tokens: 8000 },
          system: [{ type: 'text', text: 'You are the Gruvs ARCHITECT AI. Reason deeply. Return only valid JSON.' }],
          messages: [{ role: 'user', content: prompt }],
        });

        const text = (response?.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          thought = {
            ...parsed,
            logic_chain: [...thought.logic_chain, `Pass ${i + 1} (${pass.role}): ${parsed.findings || 'processed'}`],
            security_vulnerabilities: [
              ...thought.security_vulnerabilities,
              ...(parsed.security_vulnerabilities || []),
            ],
          };
        }
      } catch {
        // Pass failed — carry forward current thought unchanged
        thought.logic_chain.push(`Pass ${i + 1} (${pass.role}): skipped (API error)`);
      }
    }

    return thought;
  },
};
