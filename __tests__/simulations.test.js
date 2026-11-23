import { SaturationSimulator } from '../src/services/saturationSimulator.js';
import { NeuralMesh } from '../src/services/neuralMesh.js';

describe('Ecosystem Simulations', () => {
  it('executes economic stress test on 1,000,000 users', async () => {
    const res = await SaturationSimulator.runEconomicStressTest(1000000);
    expect(res).toBeDefined();
    expect(res.stability_rating).toBeGreaterThan(0.6);
    expect(res.bottlenecks).toBeDefined();
    expect(res.simulation_outcome).toContain('Economic sweep completed');
  });

  it('executes market launch simulation for Gauteng Festive 2026', async () => {
    const res = await SaturationSimulator.simulateMarketLaunch('Gauteng Festive 2026');
    expect(res.projected_users).toBeGreaterThan(0);
    expect(res.hype_score).toBeGreaterThan(0.5);
    expect(res.strategic_decree).toBeDefined();
  });

  it('executes neural mesh supreme thought', async () => {
    const res = await NeuralMesh.executeSupremeThought('Optimize Gauteng Ecosystem Speed');
    expect(res.execution_status).toBe('SUCCESS');
    expect(res.text).toContain('[LOCAL REASONING CORE');
  });
});
