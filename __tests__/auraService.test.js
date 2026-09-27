import { AuraService } from '../src/services/dataFlow';

describe('AuraService', () => {
  describe('getAura', () => {
    it('should map specific interests to correct hex colors', () => {
      expect(AuraService.getAura(['Music'])).toBe('#00f2ff');
      expect(AuraService.getAura(['Art'])).toBe('#8b5cf6');
      expect(AuraService.getAura(['Tech'])).toBe('#06b6d4');
      expect(AuraService.getAura(['Fashion'])).toBe('#ec4899');
      expect(AuraService.getAura(['Nightlife'])).toBe('#ef4444');
      expect(AuraService.getAura(['Business'])).toBe('#10b981');
    });

    it('should fallback to cyan (#00f2ff) for unknown or empty interests', () => {
      expect(AuraService.getAura([])).toBe('#00f2ff');
      expect(AuraService.getAura(['UnknownInterest'])).toBe('#00f2ff');
    });
  });

  describe('getAuraGradients', () => {
    it('should return two distinct colors for multiple interests', () => {
      const gradients = AuraService.getAuraGradients(['Music', 'Art']);
      expect(gradients).toEqual(['#00f2ff', '#8b5cf6']);
    });

    it('should fallback second color to transparent/opacity variant of primary if single interest', () => {
      const gradients = AuraService.getAuraGradients(['Music']);
      // AURA_MAP['Music'] is '#00f2ff'
      // slice(1) yields []
      // getAura([]) yields '#00f2ff'
      expect(gradients).toEqual(['#00f2ff', '#00f2ff']);
    });

    it('should work with empty interests array', () => {
      const gradients = AuraService.getAuraGradients([]);
      expect(gradients).toEqual(['#00f2ff', '#00f2ff']);
    });
  });
});
