/**
 * Vibe Predictor Engine v1.0
 *
 * 10X Reasoning Logic: Predicts user intent by cross-referencing
 * movement patterns, financial velocity, and social graph resonance.
 */
import { supabase } from './supabase';
import { chat, AIFeature } from './claudeService';
import projectDNA from './projectDNA.json';

export const VibePredictor = {
  /**
   * Predict the "Next Best Vibe" for a user.
   * Uses Sonnet's extended thinking to analyze complex behavior clusters.
   */
  async predictNextVibe(userId) {
    console.log(`[VibePredictor] Calculating intent for user: ${userId}`);

    // 1. Gather Multi-Dimensional Context
    const [
      { data: profile },
      { data: checkins },
      { data: memory },
      { data: recentEvents }
    ] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).single(),
      supabase.from('live_checkins').select('*, events(*)').eq('user_id', userId).order('checked_in_at', { ascending: false }).limit(20),
      supabase.from('ai_user_memory').select('*').eq('user_id', userId).single(),
      supabase.from('events').select('*').gte('event_date', new Date().toISOString().split('T')[0]).limit(30)
    ]);

    // 2. High-Precision Bayesian Utility Simulation
    const prompt = `[BAYESIAN INTENT ORACLE]
    USER_PROFILE: ${JSON.stringify(profile)}
    CULTURE_DNA: ${JSON.stringify(projectDNA.learned_context)}
    BEHAVIOR_DISTRIBUTION: ${JSON.stringify(checkins)}

    AVAILABLE_GRUVS: ${JSON.stringify(recentEvents?.map(e => ({ id: e.id, title: e.title, cat: e.category, velocity: e.vibe_count })) || [])}

    TASK: Calculate the Expected Utility (EU) for every available Gruv.
    Formula: EU = Σ P(Reward|Action) * V(Reward)
    Where:
    - P(Reward) = Probability of high-vibe social match.
    - V(Reward) = Value of the interaction to the user's Tier progression.

    1. Apply distance-decay math.
    2. Apply centrality-overlap (followed vibers).
    3. Calculate 'Vibe-Heat' resonance.

    Return JSON: {
      "predicted_event_id": "UUID",
      "confidence_score": 0.00000000,
      "expected_utility": number,
      "logic_path": "Formal logic breakdown",
      "suggested_hook": "Copy"
    }`;

    try {
      const response = await chat([{ role: 'user', content: prompt }], {
        feature: AIFeature.ARCHITECT,
        systemExtra: "You are the Vibe Oracle. Predict with 90%+ accuracy."
      });

      const prediction = JSON.parse(response.text);

      // 3. Persist Prediction for Self-Training (Fire and forget)
      (async () => { try { await supabase.from('ai_predictions').insert({ user_id: userId, event_id: prediction.predicted_event_id, confidence: prediction.confidence_score, logic: prediction.logic_path }); } catch {} })();

      return prediction;
    } catch (e) {
      console.error('[VibePredictor] Prediction failed:', e.message);
      return null;
    }
  }
};
