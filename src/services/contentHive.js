/**
 * GLOBAL CONTENT HIVE v1.0 — Autonomous Marketing Engine.
 *
 * Scans the platform for high-velocity Gruvs and converts
 * them into viral marketing assets.
 */
import { supabase } from './supabase';
import { chat, AIFeature } from './claudeService';
import projectDNA from './projectDNA.json';

export const ContentHive = {
  /**
   * Generate a "Vibe Report" for social media.
   * Tailored for the SA market with Royale aesthetics.
   */
  async generateViralDrop(eventId) {

    // 1. Fetch Event DNA
    const { data: event } = await supabase
      .from('events')
      .select('*, profiles(*)')
      .eq('id', eventId)
      .single();

    if (!event) return null;

    // 2. 32M-Token Viral Synthesis
    const prompt = `[VIRAL HOOK ENGINE]
    EVENT: ${event.title}
    CITY: ${event.city}
    HOST: @${event.profiles?.username}
    CATEGORY: ${event.category}
    VIBE VELOCITY: ${event.vibe_count} vibes in 24h

    TASK: Generate a "Market-Dominating" social media campaign.
    Requirements:
    - 1 Instagram Caption (Visual-heavy, luxury tone).
    - 3 X (Twitter) Threads (Engagement-bait, FOMO).
    - 1 WhatsApp Status Blast (Viral, short, SA slang).
    - Descriptions for AI-generated visuals.

    CULTURAL DNA: ${JSON.stringify(projectDNA.learned_context.slang)}

    Return JSON: {
      "instagram": "copy",
      "x_thread": ["part1", "part2", "part3"],
      "whatsapp": "copy",
      "visual_prompt": "description for Midjourney/DALL-E",
      "target_audience": "Who should see this?"
    }`;

    try {
      const response = await chat([{ role: 'user', content: prompt }], {
        feature: AIFeature.ROYAL_REVENUE, // Use revenue feature for marketing
        systemExtra: "You are the Head of Growth. Make it viral."
      });

      return JSON.parse(response.text);
    } catch (e) {
      console.error('[ContentHive] Asset generation failed:', e.message);
      return null;
    }
  }
};
