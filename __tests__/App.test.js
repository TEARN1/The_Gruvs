import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import App from '../App';

// Mock fetch so the auth + feed screen render without network errors
global.fetch = jest.fn(() =>
  Promise.resolve({ ok: true, json: () => Promise.resolve([]) })
);

describe('<App />', () => {
  beforeEach(() => {
    fetch.mockClear();
  });

  it('renders the auth screen correctly', () => {
    const { getByText, getByPlaceholderText } = render(<App />);
    // Matches the actual logo and auth inputs
    expect(getByText('THE GRUV')).toBeTruthy();
    expect(getByPlaceholderText('Username')).toBeTruthy();
    expect(getByPlaceholderText('Password')).toBeTruthy();
    expect(getByText('LOGIN / JOIN')).toBeTruthy();
  });

  it('navigates to feed after login', async () => {
    const { getByText, getByPlaceholderText } = render(<App />);
    const usernameInput = getByPlaceholderText('Username');
    fireEvent.changeText(usernameInput, 'Alex');
    await act(async () => {
      fireEvent.press(getByText('LOGIN / JOIN'));
    });
    // After login, the feed search bar appears
    expect(getByPlaceholderText('Search events...')).toBeTruthy();
  });

  it('shows empty feed message when no events', async () => {
    const { getByText, getByPlaceholderText } = render(<App />);
    fireEvent.changeText(getByPlaceholderText('Username'), 'Alex');
    await act(async () => {
      fireEvent.press(getByText('LOGIN / JOIN'));
    });
    expect(getByText('No events yet. Be the first!')).toBeTruthy();
  });
});
