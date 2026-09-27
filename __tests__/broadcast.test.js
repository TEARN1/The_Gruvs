import { broadcastToAttendees } from '../src/services/broadcast';

const event = { id: 'e1', author_id: 'host1', title: 'Amapiano Sunset' };

describe('broadcastToAttendees — authorisation', () => {
  // A broadcast reaches every person who committed to an event. If anyone but
  // the host could send one, it would be a spam cannon aimed at a captive list.
  it('refuses anyone who is not the host', async () => {
    const r = await broadcastToAttendees(event, 'Venue moved!', 'venue', 'not-the-host');
    expect(r.ok).toBe(false);
    expect(r.sent).toBe(0);
    expect(r.error).toMatch(/only the host/i);
  });

  it('refuses an empty message', async () => {
    const r = await broadcastToAttendees(event, '   ', 'update', 'host1');
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/short message/i);
  });

  it('refuses a missing event or host', async () => {
    expect((await broadcastToAttendees(null, 'hi', 'update', 'host1')).ok).toBe(false);
    expect((await broadcastToAttendees(event, 'hi', 'update', null)).ok).toBe(false);
  });
});
