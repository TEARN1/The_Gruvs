import { PendingIntent } from '../src/utils/pendingIntent';

beforeEach(() => PendingIntent.clear());

describe('pendingIntent — finishing what a guest tapped once they sign in', () => {
  it('hands the parked RSVP to the screen that owns it, once', () => {
    PendingIntent.set('rsvp', { eventId: 'e1', status: 'going' });
    expect(PendingIntent.take('rsvp', (p) => p.eventId === 'e1')).toEqual({ eventId: 'e1', status: 'going' });
    expect(PendingIntent.take('rsvp')).toBeNull();
  });

  it('leaves it for the right screen when another event is open', () => {
    PendingIntent.set('rsvp', { eventId: 'e1', status: 'going' });
    expect(PendingIntent.take('rsvp', (p) => p.eventId === 'e2')).toBeNull();
    expect(PendingIntent.take('rsvp', (p) => p.eventId === 'e1')).not.toBeNull();
  });

  it('ignores a different kind of action', () => {
    PendingIntent.set('follow', { userId: 'u1' });
    expect(PendingIntent.take('rsvp')).toBeNull();
  });

  it('drops a tap older than ten minutes', () => {
    PendingIntent.set('rsvp', { eventId: 'e1', status: 'going' });
    expect(PendingIntent.take('rsvp', () => true, Date.now() + 11 * 60 * 1000)).toBeNull();
    expect(PendingIntent.take('rsvp')).toBeNull(); // and forgets it
  });

  it('keeps only the latest tap', () => {
    PendingIntent.set('rsvp', { eventId: 'e1', status: 'maybe' });
    PendingIntent.set('rsvp', { eventId: 'e2', status: 'going' });
    expect(PendingIntent.take('rsvp')).toEqual({ eventId: 'e2', status: 'going' });
  });
});
