/**
 * Drives the REAL "Post a Gruv" tour flow through the UI.
 *
 * The tour bug (step 1 demanded the single Venue field, which a tour never has,
 * so NEXT stayed dead and no tour could ever be submitted) survived because this
 * component — the most business-critical one in the app — had ZERO tests. Reading
 * the code found it; only driving the UI proves it's actually fixed.
 */
import React from 'react';
import { render, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { PostEventModal } from '../src/components/PostEventModal';

jest.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1', email: 'host@test.com' } }),
}));
jest.mock('../src/context/ThemeContext', () => ({
  useTheme: () => ({ colors: { primary: '#22d3ee', background: '#0b1220', text: '#fff', muted: '#94a3b8', card: '#111' }, isDark: true }),
}));

const setup = () => render(<PostEventModal visible onClose={() => {}} />);

// Fill the fields step 1 needs regardless of tour-ness.
const fillBasics = () => {
  fireEvent.changeText(screen.getByPlaceholderText(/Give your event a name/i), 'Summer Sessions');
  const desc = screen.queryByPlaceholderText(/Describe your event/i);
  if (desc) fireEvent.changeText(desc, 'A multi-city run of shows.');
};

describe('Post a Gruv — tour flow', () => {
  it('lets a host turn on Tour mode and add stops', () => {
    setup();
    fillBasics();
    fireEvent.press(screen.getByText(/Make this a Tour/i));
    // Toggling a tour seeds a 2-stop skeleton.
    expect(screen.getAllByPlaceholderText(/Venue \*|venue/i).length).toBeGreaterThanOrEqual(2);
    fireEvent.press(screen.getByText(/Add stop/i));
    expect(screen.getAllByText(/Date \*/i).length).toBeGreaterThanOrEqual(2);
  });

  // THE BUG: with Tour on and the shared Venue left blank (as it must be),
  // pressing NEXT used to fail with "Venue / address is required" — forever.
  it('does not demand the shared Venue field for a tour', () => {
    setup();
    fillBasics();
    fireEvent.press(screen.getByText(/Make this a Tour/i));
    fireEvent.press(screen.getByText(/NEXT/i));
    expect(screen.queryByText(/Venue \/ address is required/i)).toBeNull();
  });

  // It should still refuse a tour that has no real stops — but with the RIGHT
  // message, telling the host what a tour actually needs.
  it('asks for stops, not an address, when the tour is empty', () => {
    setup();
    fillBasics();
    fireEvent.press(screen.getByText(/Make this a Tour/i));
    fireEvent.press(screen.getByText(/NEXT/i));
    expect(screen.getByText(/at least 2 stops/i)).toBeTruthy();
  });

  // A normal (non-tour) event must still require its venue — no regression.
  it('still requires a venue for a normal event', () => {
    setup();
    fillBasics();
    fireEvent.press(screen.getByText(/NEXT/i));
    expect(screen.getByText(/Venue \/ address is required/i)).toBeTruthy();
  });
});
