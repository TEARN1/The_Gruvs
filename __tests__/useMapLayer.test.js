import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useMapLayer } from '../src/hooks/useMapLayer';

describe('useMapLayer — one optional, lazily-loaded map layer', () => {
  it('loads nothing until the layer is actually turned on', async () => {
    const fetch = jest.fn(async () => [{ id: 1 }]);
    const { result } = renderHook(() => useMapLayer({ fetch }));

    expect(fetch).not.toHaveBeenCalled();
    expect(result.current.on).toBe(false);

    await act(async () => { await result.current.toggle(); });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(result.current.on).toBe(true);
    expect(result.current.data).toEqual([{ id: 1 }]);
  });

  it('does not refetch when toggled off and on again', async () => {
    const fetch = jest.fn(async () => [{ id: 1 }]);
    const { result } = renderHook(() => useMapLayer({ fetch }));

    await act(async () => { await result.current.toggle(); });
    await act(async () => { await result.current.toggle(); });
    await act(async () => { await result.current.toggle(); });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('does not refetch a legitimately EMPTY layer on every toggle', async () => {
    // The bug the old copy-pasted toggles had: `if (next && data.length === 0)`
    // refetches forever when the real answer is "there is nothing here".
    const fetch = jest.fn(async () => []);
    const { result } = renderHook(() => useMapLayer({ fetch }));

    await act(async () => { await result.current.toggle(); });
    await act(async () => { await result.current.toggle(); });
    await act(async () => { await result.current.toggle(); });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('retries after a failed load rather than pretending it loaded', async () => {
    const fetch = jest.fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce([{ id: 7 }]);
    const { result } = renderHook(() => useMapLayer({ fetch }));

    await act(async () => { await result.current.toggle(); });
    expect(result.current.data).toEqual([]);

    await act(async () => { await result.current.toggle(); }); // off
    await act(async () => { await result.current.toggle(); }); // on -> retry
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(result.current.data).toEqual([{ id: 7 }]);
  });

  it('prompts sign-in instead of loading when the layer needs auth', async () => {
    const fetch = jest.fn(async () => [{ id: 1 }]);
    const onAuthRequired = jest.fn();
    const { result } = renderHook(() =>
      useMapLayer({ fetch, requiresAuth: true, user: null, onAuthRequired }));

    await act(async () => { await result.current.toggle(); });
    expect(onAuthRequired).toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
    expect(result.current.on).toBe(false);
  });

  it('toasts the empty message only when a load really came back empty', async () => {
    const toast = jest.fn();
    const { result } = renderHook(() =>
      useMapLayer({ fetch: async () => [], emptyMessage: 'Nothing here yet', toast }));

    await act(async () => { await result.current.toggle(); });
    expect(toast).toHaveBeenCalledWith('Nothing here yet', 'info');
  });

  it('refreshIfOn re-loads a visible layer and only re-arms a hidden one', async () => {
    const fetch = jest.fn(async () => [{ id: 1 }]);
    const { result } = renderHook(() => useMapLayer({ fetch }));

    // Hidden: must not hit the network just because the viewport moved.
    await act(async () => { await result.current.refreshIfOn(); });
    expect(fetch).not.toHaveBeenCalled();

    await act(async () => { await result.current.toggle(); });
    expect(fetch).toHaveBeenCalledTimes(1);

    await act(async () => { await result.current.refreshIfOn(); });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('ignores a second toggle fired while the first load is still in flight', async () => {
    let release;
    const fetch = jest.fn(() => new Promise((res) => { release = () => res([{ id: 1 }]); }));
    const { result } = renderHook(() => useMapLayer({ fetch }));

    act(() => { result.current.toggle(); });
    act(() => { result.current.load(); });
    expect(fetch).toHaveBeenCalledTimes(1);

    await act(async () => { release(); });
    await waitFor(() => expect(result.current.data).toEqual([{ id: 1 }]));
  });
});
