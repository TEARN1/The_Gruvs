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

const OWNER_EMAIL = 'asemahlenkwali@gmail.com';

describe('useIsAdmin gate', () => {
  it('denies when there is no signed-in user', async () => {
    mockUser = null;
    const { result } = renderHook(() => useIsAdmin(true));
    await waitFor(() => expect(result.current).toBe(false));
  });

  it('grants when the server is_admin flag is true', async () => {
    mockUser = { id: 'u1', email: 'someone@example.com' };
    mockProfileResult = { data: { is_admin: true }, error: null };
    const { result } = renderHook(() => useIsAdmin(true));
    await waitFor(() => expect(result.current).toBe(true));
  });

  it('denies a normal user (is_admin false, not the owner email)', async () => {
    mockUser = { id: 'u2', email: 'someone@example.com' };
    mockProfileResult = { data: { is_admin: false }, error: null };
    const { result } = renderHook(() => useIsAdmin(true));
    await waitFor(() => expect(result.current).toBe(false));
  });

  it('bootstraps via owner email when the is_admin column is missing', async () => {
    mockUser = { id: 'u3', email: OWNER_EMAIL };
    mockProfileResult = { data: null, error: { code: '42703' } }; // undefined_column
    const { result } = renderHook(() => useIsAdmin(true));
    await waitFor(() => expect(result.current).toBe(true));
  });
});
