import { posterWhen } from '../src/components/EventPoster';

describe('EventPoster — the date line on a generated poster', () => {
  it('shows the day, date and start time', () => {
    expect(posterWhen('2026-10-24', '21:00:00')).toMatch(/^SAT 24 OCT · 21:00$/);
  });

  it('leaves the time off when there is none', () => {
    expect(posterWhen('2026-10-24', null)).toMatch(/^SAT 24 OCT$/);
    expect(posterWhen('2026-10-24', 'late')).toMatch(/^SAT 24 OCT$/);
  });

  it('says nothing rather than something wrong', () => {
    expect(posterWhen(null, '21:00')).toBe('');
    expect(posterWhen('not a date', '21:00')).toBe('');
  });
});
