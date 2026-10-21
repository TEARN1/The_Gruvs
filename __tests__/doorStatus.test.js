import AsyncStorage from '@react-native-async-storage/async-storage';
import { DoorStatusService, DOOR_LEVELS, DOOR_REPORT_KINDS } from '../src/services/doorStatus';
import { MapReports } from '../src/services/mapReports';
import { supabase } from '../src/services/supabase';
import { MAP_REPORT_BY_KEY, MAP_REPORT_GROUPS } from '../src/constants/mapContributions';

jest.mock('../src/utils/logError', () => ({ logError: jest.fn() }));
jest.mock('../src/services/mapReports', () => ({ MapReports: { create: jest.fn(() => Promise.resolve({})) } }));

// Records every filter so the test can assert what was actually asked of map_reports.
const mockCalls = [];
let mockResult = { data: null, error: null };
jest.mock('../src/services/supabase', () => {
  const chain = {};
  ['select', 'in', 'gt', 'gte', 'lte', 'order', 'limit'].forEach((m) => {
    chain[m] = jest.fn((...args) => { mockCalls.push([m, ...args]); return chain; });
  });
  chain.maybeSingle = jest.fn(() => Promise.resolve(mockResult));
  return { supabase: { from: jest.fn(() => chain) } };
});

const venue = { lat: -26.2041, lon: 28.0473 };
let n = 0;
const freshId = () => `event-${++n}`; // memoryCache is module-level — never reuse an id

beforeEach(async () => {
  mockCalls.length = 0;
  mockResult = { data: null, error: null };
  jest.clearAllMocks();
  await AsyncStorage.clear();
});

describe('doorStatus — the door line is only ever what someone actually reported', () => {
  it('says nothing (null) when nobody has reported, instead of claiming "Walk in"', async () => {
    expect(await DoorStatusService.getStatus(freshId(), venue)).toBeNull();
  });

  it('never queries the map_reports.event_id column that does not exist', async () => {
    await DoorStatusService.getStatus(freshId(), venue);
    expect(supabase.from).toHaveBeenCalledWith('map_reports');
    expect(mockCalls.some(([, col]) => col === 'event_id')).toBe(false);
  });

  it('looks for live door pins in a tight box around the venue', async () => {
    await DoorStatusService.getStatus(freshId(), venue);
    expect(mockCalls).toContainEqual(['in', 'kind', DOOR_REPORT_KINDS]);
    expect(mockCalls.find(([m, col]) => m === 'gt' && col === 'expires_at')).toBeTruthy();
    const latLo = mockCalls.find(([m, col]) => m === 'gte' && col === 'lat')[2];
    const latHi = mockCalls.find(([m, col]) => m === 'lte' && col === 'lat')[2];
    expect((latHi - latLo) * 111000).toBeLessThan(150); // metres, ~60 m each side
  });

  it('reads back the latest crowd report', async () => {
    mockResult = { data: { kind: 'door_packed', created_at: new Date().toISOString() }, error: null };
    expect(await DoorStatusService.getStatus(freshId(), venue)).toBe(DOOR_LEVELS.packed);
  });

  it('skips the server when it has no venue coords to look near', async () => {
    expect(await DoorStatusService.getStatus(freshId(), null)).toBeNull();
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('shares a signed-in report as a map pin at the venue', async () => {
    await DoorStatusService.reportStatus(freshId(), 'user-1', 'capacity', venue);
    expect(MapReports.create).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'door_capacity', lat: venue.lat, lon: venue.lon,
    }));
  });

  it('keeps a signed-out report on this device only, and still shows it here', async () => {
    const id = freshId();
    expect(await DoorStatusService.reportStatus(id, null, 'steady', venue)).toBe(true);
    expect(MapReports.create).not.toHaveBeenCalled();
    expect(await DoorStatusService.getStatus(id, venue)).toBe(DOOR_LEVELS.steady);
  });

  it('gives every door kind a map label, without adding them to the report picker', () => {
    DOOR_REPORT_KINDS.forEach((k) => expect(MAP_REPORT_BY_KEY[k]?.label).toBeTruthy());
    const pickerKeys = Object.values(MAP_REPORT_GROUPS).flat().map((t) => t.key);
    DOOR_REPORT_KINDS.forEach((k) => expect(pickerKeys).not.toContain(k));
  });
});
