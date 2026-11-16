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
    // One server call: create_service_booking() takes the provider from the
    // listing (never from the phone), refuses self-booking and bounds the amount.
    it('creates the booking through create_service_booking and returns its id', async () => {
      supabase.rpc.mockResolvedValueOnce({ data: 'booking-123', error: null });
      const result = await EscrowService.lockFunds({
        requester_id: 'client-1',
        provider_id: 'provider-1',
        service_node_id: 'node-1',
        cargo_type: 'Logistics',
        pickup_address: '123 Pick St',
        dropoff_address: '456 Drop Rd',
        scheduled_at: '2026-06-07T00:00:00.000Z',
        amount_cents: 5000,
      });
      expect(result).toBe('booking-123');
      expect(supabase.rpc).toHaveBeenCalledWith('create_service_booking', {
        p_service_node_id: 'node-1',
        p_amount_cents: 5000,
        p_cargo_type: 'Logistics',
        p_pickup_address: '123 Pick St',
        p_dropoff_address: '456 Drop Rd',
        p_scheduled_at: '2026-06-07T00:00:00.000Z',
      });
      // provider_id / client_id are NOT sent — the server decides them.
      expect(supabase.from).not.toHaveBeenCalledWith('service_bookings');
    });

    it('returns null when the server refuses', async () => {
      supabase.rpc.mockResolvedValueOnce({ data: null, error: new Error('you cannot book your own service') });
      expect(await EscrowService.lockFunds({ service_node_id: 'node-1', amount_cents: 100 })).toBeNull();
    });

    it('returns null without calling the server when no listing is given', async () => {
      expect(await EscrowService.lockFunds({})).toBeNull();
      expect(supabase.rpc).not.toHaveBeenCalled();
    });
  });

  describe('releaseToProvider', () => {
    // Escrow release is one authorized, atomic server call:
    // release_escrow_to_provider(p_booking_id) verifies auth.uid() is the CLIENT
    // who paid, that the booking is still escrow_held, then settles it under a
    // row lock. See supabase/migrations/20260927000200_definer_rpc_hardening.sql.
    it('releases through the authorized RPC and fires trust/XP hooks', async () => {
      supabase.rpc.mockResolvedValueOnce({
        data: [{ booking_id: 'booking-123', provider_id: 'provider-1', amount_cents: 10000 }],
        error: null,
      });

      const result = await EscrowService.releaseToProvider('booking-123', 'provider-1');
      expect(result).toBe(true);

      // The booking id is the only thing the client gets to assert — the server
      // reads the provider and amount off the booking, so a caller cannot aim
      // the payout at someone else or change what it is worth.
      expect(supabase.rpc).toHaveBeenCalledWith('release_escrow_to_provider', {
        p_booking_id: 'booking-123',
      });

      expect(TrustLedger.updateAfterPath).toHaveBeenCalledWith('provider-1', {
        checkinReliable: true,
        cargoIntact: true,
        socialPositive: true,
      });
      expect(LevelManager.addXP).toHaveBeenCalledWith('provider-1', 'BOOKING_COMPLETE');
    });

    it('returns false when the server refuses the release', async () => {
      // e.g. the caller is the provider rather than the payer, or the booking is
      // already completed — the RPC raises and PostgREST surfaces an error.
      supabase.rpc.mockResolvedValueOnce({
        data: null,
        error: new Error('only the client who paid may release this escrow'),
      });

      const result = await EscrowService.releaseToProvider('booking-123', 'provider-1');
      expect(result).toBe(false);
      expect(TrustLedger.updateAfterPath).not.toHaveBeenCalled();
      expect(LevelManager.addXP).not.toHaveBeenCalled();
    });

    it('returns false when the RPC settles no booking', async () => {
      supabase.rpc.mockResolvedValueOnce({ data: [], error: null });

      const result = await EscrowService.releaseToProvider('booking-123', 'provider-1');
      expect(result).toBe(false);
      expect(LevelManager.addXP).not.toHaveBeenCalled();
    });

    it('requires a bookingId', async () => {
      const result = await EscrowService.releaseToProvider(undefined, 'provider-1');
      expect(result).toBe(false);
      expect(supabase.rpc).not.toHaveBeenCalled();
    });

    // ── Security regression guard ──────────────────────────────────────────
    // This replaces a test that used to assert the opposite ("falls back to
    // manual wallet update if RPC fails"). That fallback wrote wallet_balance
    // straight from the client, and the test locked the behaviour in. Money must
    // only move server-side, so a failed release must move nothing at all.
    it('NEVER writes wallet_balance from the client, even when the RPC fails', async () => {
      supabase.rpc.mockResolvedValueOnce({ data: null, error: new Error('RPC Failed') });

      const result = await EscrowService.releaseToProvider('booking-123', 'provider-1');
      expect(result).toBe(false);

      expect(supabase.from).not.toHaveBeenCalledWith('profiles');
      const wroteWallet = mockUpdate.mock.calls.some(
        ([payload]) => payload && Object.prototype.hasOwnProperty.call(payload, 'wallet_balance'),
      );
      expect(wroteWallet).toBe(false);
    });
  });

  describe('initiateDispute', () => {
    it('opens the dispute through open_dispute', async () => {
      supabase.rpc.mockResolvedValueOnce({ data: 'dispute-1', error: null });
      const result = await EscrowService.initiateDispute('booking-123', 'Late arrival', 'client-1');
      expect(result).toBe(true);
      expect(supabase.rpc).toHaveBeenCalledWith('open_dispute', {
        p_booking_id: 'booking-123',
        p_reason: 'Late arrival',
      });
      expect(supabase.from).not.toHaveBeenCalledWith('disputes');
    });

    it('returns false when the server refuses (caller not a party)', async () => {
      supabase.rpc.mockResolvedValue({ data: null, error: new Error('booking not found') });
      const result = await EscrowService.initiateDispute('booking-123', 'Some reason', 'outsider-1');
      expect(result).toBe(false);
    });

    it('requires a caller id', async () => {
      expect(await EscrowService.initiateDispute('booking-123', 'x', null)).toBe(false);
      expect(supabase.rpc).not.toHaveBeenCalled();
    });
  });
});
