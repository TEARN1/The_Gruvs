/**
 * @jest-environment jsdom
 */
import React from 'react';
import { Text } from 'react-native';
import { render, screen, fireEvent, act } from '@testing-library/react-native';
import { ErrorBoundary } from '../src/components/ErrorBoundary';

jest.mock('../src/services/securityService', () => ({ SecurityService: { logSecurityEvent: jest.fn() } }));
jest.mock('../src/utils/logError', () => ({ logError: jest.fn() }));
jest.mock('../src/utils/bootGuard', () => ({ recordCriticalCrash: jest.fn() }));

const mockCheckForNewVersion = jest.fn();
jest.mock('../src/hooks/useWebAppUpdate', () => ({
  checkForNewVersion: (...args) => mockCheckForNewVersion(...args),
}));

// A component that throws on every render until `stopThrowing` is set true —
// simulates a crash that clears up after a remount/retry.
function Bomb({ stopThrowingRef, message = 'boom' }) {
  if (!stopThrowingRef.current) throw new Error(message);
  return <Text>recovered</Text>;
}

beforeEach(() => {
  mockCheckForNewVersion.mockReset().mockResolvedValue(false);
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  console.error.mockRestore();
});

// NOTE: fake timers are enabled/disabled WITHIN each test that needs them,
// never globally in before/afterEach — @testing-library/react-native
// registers its own cleanup afterEach at import time, which runs BEFORE any
// afterEach declared later in this file. If fake timers are still active when
// that cleanup runs, its internal act()/unmount hangs and times out the hook.
// Restoring real timers at the end of the test body itself (before RTL's
// cleanup ever runs) avoids that entirely.

describe('ErrorBoundary — graduated recovery for ordinary errors', () => {
  it('auto-retries once after 900ms, then shows the fallback if it keeps failing', async () => {
    jest.useFakeTimers();
    const stopThrowingRef = { current: false };
    render(
      <ErrorBoundary label="Test Section">
        <Bomb stopThrowingRef={stopThrowingRef} />
      </ErrorBoundary>
    );
    // First catch: silent auto-retry scheduled, no fallback shown yet mid-wait.
    await act(async () => { jest.advanceTimersByTime(900); });
    // Still throwing -> second catch -> another retry (with remount) scheduled.
    await act(async () => { jest.advanceTimersByTime(900); });
    // Still throwing -> third catch -> no more timers, static fallback shown.
    expect(screen.getByText('Test Section needs a moment')).toBeTruthy();
    jest.useRealTimers();
  });

  it('recovers cleanly if the failure clears before retries are exhausted', async () => {
    jest.useFakeTimers();
    const stopThrowingRef = { current: false };
    render(
      <ErrorBoundary label="Test Section">
        <Bomb stopThrowingRef={stopThrowingRef} />
      </ErrorBoundary>
    );
    stopThrowingRef.current = true; // fixed before the auto-retry fires
    await act(async () => { jest.advanceTimersByTime(900); });
    expect(screen.getByText('recovered')).toBeTruthy();
    jest.useRealTimers();
  });
});

describe('ErrorBoundary — chunk-load / version-skew path', () => {
  it('auto-reloads without showing any fallback when a version mismatch is confirmed', async () => {
    mockCheckForNewVersion.mockResolvedValue(true);
    const reloadSpy = jest.fn();
    const originalLocation = window.location;
    delete window.location;
    window.location = { reload: reloadSpy };

    const stopThrowingRef = { current: false };
    render(
      <ErrorBoundary label="God View" lazyBoundary>
        <Bomb stopThrowingRef={stopThrowingRef} />
      </ErrorBoundary>
    );
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(reloadSpy).toHaveBeenCalled();

    window.location = originalLocation;
  });

  it('falls through to the fallback UI, Reload-primary, when no version mismatch is found', async () => {
    mockCheckForNewVersion.mockResolvedValue(false);
    const stopThrowingRef = { current: false };
    render(
      <ErrorBoundary label="God View" lazyBoundary>
        <Bomb stopThrowingRef={stopThrowingRef} />
      </ErrorBoundary>
    );
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(screen.getByText('God View needs a moment')).toBeTruthy();
    expect(screen.getByText('Reload app')).toBeTruthy();
  });

  it('never schedules a useless auto-retry for a lazy-boundary catch', async () => {
    jest.useFakeTimers();
    mockCheckForNewVersion.mockResolvedValue(false);
    const stopThrowingRef = { current: false };
    render(
      <ErrorBoundary label="God View" lazyBoundary>
        <Bomb stopThrowingRef={stopThrowingRef} />
      </ErrorBoundary>
    );
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    // If an auto-retry had been scheduled, advancing time would clear
    // hasError and re-throw (Bomb still throws) — assert the fallback is
    // still visible after the window a stray timer would have fired in.
    await act(async () => { jest.advanceTimersByTime(2000); });
    expect(screen.getByText('God View needs a moment')).toBeTruthy();
    jest.useRealTimers();
  });
});

describe('ErrorBoundary — critical (root) boundaries', () => {
  it('shows shell-level copy and leads with Reload', async () => {
    jest.useFakeTimers();
    const stopThrowingRef = { current: false };
    render(
      <ErrorBoundary critical label="App shell">
        <Bomb stopThrowingRef={stopThrowingRef} />
      </ErrorBoundary>
    );
    await act(async () => { jest.advanceTimersByTime(900); });
    await act(async () => { jest.advanceTimersByTime(900); });
    expect(screen.getByText('The Gruvs hit a snag starting up')).toBeTruthy();
    expect(screen.getByText('Reload app')).toBeTruthy();
    jest.useRealTimers();
  });

  it('writes to the boot-crash log on every critical catch', () => {
    const { recordCriticalCrash } = require('../src/utils/bootGuard');
    const stopThrowingRef = { current: false };
    render(
      <ErrorBoundary critical label="App shell">
        <Bomb stopThrowingRef={stopThrowingRef} />
      </ErrorBoundary>
    );
    expect(recordCriticalCrash).toHaveBeenCalled();
  });

  it('does NOT write to the boot-crash log for a non-critical boundary', () => {
    const { recordCriticalCrash } = require('../src/utils/bootGuard');
    recordCriticalCrash.mockClear();
    const stopThrowingRef = { current: false };
    render(
      <ErrorBoundary label="Some section">
        <Bomb stopThrowingRef={stopThrowingRef} />
      </ErrorBoundary>
    );
    expect(recordCriticalCrash).not.toHaveBeenCalled();
  });
});

describe('ErrorBoundary — manual reset', () => {
  it('"Try again" re-attempts rendering the children', async () => {
    jest.useFakeTimers();
    const stopThrowingRef = { current: false };
    const { getByText } = render(
      <ErrorBoundary label="Test Section">
        <Bomb stopThrowingRef={stopThrowingRef} />
      </ErrorBoundary>
    );
    await act(async () => { jest.advanceTimersByTime(900); });
    await act(async () => { jest.advanceTimersByTime(900); });
    stopThrowingRef.current = true;
    jest.useRealTimers();
    fireEvent.press(getByText('Try again'));
    expect(getByText('recovered')).toBeTruthy();
  });
});
