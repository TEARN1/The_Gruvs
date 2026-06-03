import { renderHook, waitFor } from '@testing-library/react-native';

// ── Mock the auth context and the supabase client the hook depends on ────────
let mockUser = null;
jest.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({ user: mockUser }),
}));

let mockProfileResult = { data: null, error: null };
jest.mock('../src/services/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => mockProfileResult }),
      }),
    }),
  },
}));

import { useIsAdmin } from '../src/hooks/useIsAdmin';

describe('useIsAdmin gate', () => {
  it('denies when there is no signed-in user', async () => {
    mockUser = null;
    const { result } = renderHook(() => useIsAdmin(true));
    await waitFor(() => expect(result.current).toBe(false));
  });

  it('grants when the server role is admin', async () => {
    mockUser = { id: 'u1', email: 'someone@example.com' };
    mockProfileResult = { data: { role: 'admin' }, error: null };
    const { result } = renderHook(() => useIsAdmin(true));
    await waitFor(() => expect(result.current).toBe(true));
  });

  it('denies a normal user (role user)', async () => {
    mockUser = { id: 'u2', email: 'someone@example.com' };
    mockProfileResult = { data: { role: 'user' }, error: null };
    const { result } = renderHook(() => useIsAdmin(true));
    await waitFor(() => expect(result.current).toBe(false));
  });

  it('denies access when the role column is missing or query fails', async () => {
    mockUser = { id: 'u3', email: 'owner@example.com' };
    mockProfileResult = { data: null, error: { code: '42703' } }; // undefined_column
    const { result } = renderHook(() => useIsAdmin(true));
    await waitFor(() => expect(result.current).toBe(false));
  });
});
