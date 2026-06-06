import { EscrowService } from '../src/services/escrowService';
import { supabase } from '../src/services/supabase';
import { TrustLedger } from '../src/services/trustLedger';
import { LevelManager } from '../src/services/dataFlow';

// Mock TrustLedger
jest.mock('../src/services/trustLedger', () => ({
  TrustLedger: {
    updateAfterPath: jest.fn(() => Promise.resolve(true)),
  },
}));

// Mock LevelManager
jest.mock('../src/services/dataFlow', () => ({
  LevelManager: {
    addXP: jest.fn(() => Promise.resolve(true)),
  },
}));

// Mock log and retry
jest.mock('../src/utils/log', () => ({
  log: {
    error: jest.fn(),
    info: jest.fn(),
  },
}));

jest.mock('../src/utils/retry', () => ({
  withRetry: jest.fn((fn) => fn()),
}));

// Mock Supabase
const mockSingle = jest.fn();
const mockMaybeSingle = jest.fn();
const mockSelect = jest.fn(() => ({
  single: mockSingle,
  maybeSingle: mockMaybeSingle,
  eq: jest.fn().mockReturnThis(),
  or: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
}));
const mockUpdate = jest.fn(() => ({
  eq: jest.fn().mockReturnThis(),
  or: jest.fn().mockReturnThis(),
}));
const mockInsert = jest.fn(() => ({
  select: mockSelect,
}));
const mockDelete = jest.fn(() => ({
  eq: jest.fn().mockReturnThis(),
}));

jest.mock('../src/services/supabase', () => ({
  supabase: {
    from: jest.fn((table) => ({
      select: mockSelect,
      insert: mockInsert,
      update: mockUpdate,
      delete: mockDelete,
      eq: jest.fn().mockReturnThis(),
      or: jest.fn().mockReturnThis(),
    })),
    rpc: jest.fn(),
  },
}));

describe('EscrowService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('lockFunds', () => {
    it('creates a service booking and returns the new booking ID', async () => {
      mockSingle.mockResolvedValueOnce({ data: { id: 'booking-123' }, error: null });
      const bookingData = {
        requester_id: 'client-1',
        provider_id: 'provider-1',
        service_node_id: 'node-1',
        cargo_type: 'Logistics',
        pickup_address: '123 Pick St',
        dropoff_address: '456 Drop Rd',
        scheduled_at: '2026-06-07T00:00:00.000Z',
        amount_cents: 5000,
      };

      const result = await EscrowService.lockFunds(bookingData);
      expect(result).toBe('booking-123');
      expect(supabase.from).toHaveBeenCalledWith('service_bookings');
      expect(mockInsert).toHaveBeenCalledWith([
        expect.objectContaining({
          client_id: 'client-1',
          provider_id: 'provider-1',
          status: 'escrow_held',
          amount_cents: 5000,
          estimated_price: 50,
        }),
      ]);
    });

    it('returns null on failure', async () => {
      mockSingle.mockResolvedValueOnce({ data: null, error: new Error('DB error') });
      const result = await EscrowService.lockFunds({});
      expect(result).toBeNull();
    });
  });

  describe('releaseToProvider', () => {
    it('verifies provider ownership and releases funds, updating trust/XP', async () => {
      // 1. Fetch booking details success
      mockSingle.mockResolvedValueOnce({
        data: { amount_cents: 10000, client_id: 'client-1', provider_id: 'provider-1' },
        error: null,
      });
      // 2. Mock wallet increment RPC success
      supabase.rpc.mockResolvedValueOnce({ data: null, error: null });

      const result = await EscrowService.releaseToProvider('booking-123', 'provider-1');
      expect(result).toBe(true);

      // Verify ownership filter eq('provider_id', providerId) was checked
      expect(supabase.from).toHaveBeenCalledWith('service_bookings');
      expect(mockSelect).toHaveBeenCalledWith('amount_cents, client_id, provider_id');

      // Verify wallet RPC was called
      expect(supabase.rpc).toHaveBeenCalledWith('increment_wallet_balance', {
        user_id: 'provider-1',
        amount: 100, // 10000 cents / 100
      });

      // Verify integration hooks triggered
      expect(TrustLedger.updateAfterPath).toHaveBeenCalledWith('provider-1', {
        checkinReliable: true,
        cargoIntact: true,
        socialPositive: true,
      });
      expect(LevelManager.addXP).toHaveBeenCalledWith('provider-1', 'BOOKING_COMPLETE');
    });

    it('blocks release if providerId does not match ownership', async () => {
      // Mock fetch return null (meaning not found with this providerId and status escrow_held)
      mockSingle.mockResolvedValueOnce({ data: null, error: new Error('Not found') });

      const result = await EscrowService.releaseToProvider('booking-123', 'unauthorized-provider');
      expect(result).toBe(false);
      expect(supabase.rpc).not.toHaveBeenCalled();
    });

    it('falls back to manual wallet update if RPC fails', async () => {
      // 1. Fetch booking details
      mockSingle.mockResolvedValueOnce({
        data: { amount_cents: 10000, client_id: 'client-1', provider_id: 'provider-1' },
        error: null,
      });
      // 2. Mock wallet increment RPC fails
      supabase.rpc.mockResolvedValueOnce({ data: null, error: new Error('RPC Failed') });
      // 3. Mock profiles fetch for manual update
      mockSingle.mockResolvedValueOnce({
        data: { wallet_balance: 50 },
        error: null,
      });

      const result = await EscrowService.releaseToProvider('booking-123', 'provider-1');
      expect(result).toBe(true);

      // Verify manual update was called
      expect(supabase.from).toHaveBeenCalledWith('profiles');
      expect(mockUpdate).toHaveBeenCalledWith({ wallet_balance: 150 }); // 50 + 100
    });
  });

  describe('initiateDispute', () => {
    it('allows client or provider of the booking to raise a dispute', async () => {
      // 1. Fetch check success
      mockSingle.mockResolvedValueOnce({ data: { id: 'booking-123' }, error: null });
      // 2. Mock insert dispute success
      mockInsert.mockReturnValueOnce({ error: null });

      const result = await EscrowService.initiateDispute('booking-123', 'Late arrival', 'client-1');
      expect(result).toBe(true);

      // Verify update status disputed
      expect(mockUpdate).toHaveBeenCalledWith({ status: 'disputed' });
      // Verify insert dispute record
      expect(supabase.from).toHaveBeenCalledWith('disputes');
      expect(mockInsert).toHaveBeenCalledWith([
        expect.objectContaining({
          booking_id: 'booking-123',
          raised_by: 'client-1',
          reason: 'Late arrival',
          status: 'open',
        }),
      ]);
    });

    it('denies dispute raising if caller is not a party to the booking', async () => {
      mockSingle.mockResolvedValueOnce({ data: null, error: new Error('Not found') });

      const result = await EscrowService.initiateDispute('booking-123', 'Some reason', 'outsider-1');
      expect(result).toBe(false);
    });
  });
});
