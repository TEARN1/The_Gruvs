import { synth, renderSamples, encodeWav, HZ } from '../src/utils/soundSynth';

const toneRecipe = { sampleRate: 8000, voices: [{ type: 'sine', f0: HZ.E5, start: 0, dur: 0.1, gain: 0.5 }] };

describe('soundSynth', () => {
  it('synth returns a WAV data URI', () => {
    const uri = synth(toneRecipe);
    expect(uri.startsWith('data:audio/wav;base64,')).toBe(true);
    expect(uri.length).toBeGreaterThan(100);
  });

  it('is deterministic (same recipe → identical output)', () => {
    expect(synth(toneRecipe)).toBe(synth(toneRecipe));
  });

  it('writes a valid RIFF/WAVE header', () => {
    const b64 = synth(toneRecipe).split(',')[1];
    const bytes = Buffer.from(b64, 'base64');
    expect(bytes.slice(0, 4).toString('ascii')).toBe('RIFF');
    expect(bytes.slice(8, 12).toString('ascii')).toBe('WAVE');
    expect(bytes.slice(36, 40).toString('ascii')).toBe('data');
  });

  it('a tone actually produces audio energy', () => {
    const s = renderSamples(toneRecipe);
    const peak = Math.max(...Array.from(s).map(Math.abs));
    expect(peak).toBeGreaterThan(0.3); // real signal, not silence
  });

  it('samples stay within [-1, 1] (no clipping past full-scale)', () => {
    const s = renderSamples({ sampleRate: 8000, voices: [
      { type: 'sine', f0: HZ.C5, start: 0, dur: 0.1, gain: 5 },   // deliberately hot
      { type: 'triangle', f0: HZ.G5, start: 0, dur: 0.1, gain: 5 },
    ] });
    for (const v of s) expect(Math.abs(v)).toBeLessThanOrEqual(1);
  });

  it('empty recipe yields a valid (silent) buffer, not a crash', () => {
    expect(() => synth({})).not.toThrow();
    const s = renderSamples({});
    expect(s.length).toBeGreaterThan(0);
  });

  it('encodeWav length = 44 header + 2 bytes/sample', () => {
    const bytes = encodeWav(new Float32Array(100), 8000);
    expect(bytes.length).toBe(44 + 200);
  });
});
