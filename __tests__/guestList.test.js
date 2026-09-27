import { toCsv } from '../src/services/guestList';

describe('guest list CSV', () => {
  it('puts RSVP next to VERIFIED attendance — the thing a spreadsheet cannot do', () => {
    const csv = toCsv([
      { username: 'thabo', name: 'Thabo M', rsvp: 'going', touchedDown: true, touchedDownAt: '2026-08-15T19:30:00Z' },
      { username: 'lerato', name: 'Lerato K', rsvp: 'going', touchedDown: false, touchedDownAt: null },
    ]);
    const lines = csv.split('\n');
    expect(lines[0]).toBe('Username,Name,RSVP,Arrived,Arrived at');
    expect(lines[1]).toContain('thabo');
    expect(lines[1]).toContain('YES');
    expect(lines[2]).toContain('lerato');
    expect(lines[2]).toContain(',no,');
  });

  it('escapes commas and quotes so one name cannot break the file', () => {
    const csv = toCsv([{ username: 'dj', name: 'Smith, "The Vibe"', rsvp: 'going', touchedDown: false }]);
    expect(csv).toContain('"Smith, ""The Vibe"""');
  });

  // A username like "=cmd()" would EXECUTE when the host opens the CSV in Excel.
  // The host is a victim here, not the attacker — neutralise it.
  it('neutralises formula injection', () => {
    const csv = toCsv([{ username: '=1+1', name: '@SUM(A1)', rsvp: 'going', touchedDown: false }]);
    expect(csv).toContain("'=1+1");
    expect(csv).toContain("'@SUM(A1)");
  });

  it('handles an empty list', () => {
    expect(toCsv([])).toBe('Username,Name,RSVP,Arrived,Arrived at');
    expect(toCsv(null)).toBe('Username,Name,RSVP,Arrived,Arrived at');
  });
});
