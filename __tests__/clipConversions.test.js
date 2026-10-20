import AsyncStorage from '@react-native-async-storage/async-storage';
import { ClipConversions } from '../src/services/clipConversions';
import { supabase } from '../src/services/supabase';

const mockUpsert = jest.fn(() => Promise.resolve({ error: null }));
jest.mock('../src/services/supabase', () => ({ supabase: { from: jest.fn(() => ({ upsert: mockUpsert })) } }));

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
});

const open = { reelId: 'r1', eventId: 'e1', viewerId: 'v1', authorId: 'a1' };

describe('clipConversions — crediting the clip that sent someone', () => {
  it('records an event_open when a viewer taps a clip’s event', async () => {
    await ClipConversions.recordOpen(open);
    expect(supabase.from).toHaveBeenCalledWith('reel_conversions');
    expect(mockUpsert).toHaveBeenCalledWith(
      { reel_id: 'r1', event_id: 'e1', viewer_id: 'v1', kind: 'event_open' },
      expect.objectContaining({ ignoreDuplicates: true }),
    );
  });

  it('credits the RSVP that follows to that clip', async () => {
    await ClipConversions.recordOpen(open);
    mockUpsert.mockClear();
    await ClipConversions.recordRsvp({ eventId: 'e1', viewerId: 'v1' });
    expect(mockUpsert).toHaveBeenCalledWith(
      { reel_id: 'r1', event_id: 'e1', viewer_id: 'v1', kind: 'rsvp' },
      expect.anything(),
    );
  });

  it('credits nothing when the event was not opened from a clip', async () => {
    await ClipConversions.recordRsvp({ eventId: 'e1', viewerId: 'v1' });
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('forgets the clip after a day', async () => {
    await ClipConversions.recordOpen(open);
    expect(await ClipConversions.openedFrom('e1', Date.now() + 25 * 3600 * 1000)).toBeNull();
    expect(await ClipConversions.openedFrom('e1')).toBe('r1');
  });

  it('never credits a creator for their own clip, or a guest with no account', async () => {
    await ClipConversions.recordOpen({ ...open, viewerId: 'a1' });
    await ClipConversions.recordOpen({ ...open, viewerId: null });
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('never throws if the table is not there yet', async () => {
    mockUpsert.mockImplementationOnce(() => Promise.reject(new Error('relation does not exist')));
    await expect(ClipConversions.recordOpen(open)).resolves.toBeUndefined();
  });
});
