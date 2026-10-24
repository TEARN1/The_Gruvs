/**
 * AppProviders.js — Clean, declarative composition of all top-level application context providers.
 */
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from './ThemeContext';
import { AuthProvider } from './AuthContext';
import { EntitlementProvider } from './EntitlementContext';
import { IdentityProvider } from './IdentityContext';
import { CurrencyProvider } from './CurrencyContext';
import { TutorialProvider } from './TutorialContext';
import { ToastProvider } from '../components/ToastNotification';
import { CallProvider } from './CallContext';
import { AppLockGate } from '../components/AppLockGate';
import { ErrorBoundary } from '../components/ErrorBoundary';

export function AppProviders({ children }) {
  return (
    <ErrorBoundary critical label="App shell">
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthProvider>
            <EntitlementProvider>
              <IdentityProvider>
                <CurrencyProvider>
                  <TutorialProvider>
                    <ToastProvider>
                      <CallProvider>
                        <ErrorBoundary critical label="Main navigator">
                          <AppLockGate>{children}</AppLockGate>
                        </ErrorBoundary>
                      </CallProvider>
                    </ToastProvider>
                  </TutorialProvider>
                </CurrencyProvider>
              </IdentityProvider>
            </EntitlementProvider>
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

export default AppProviders;
