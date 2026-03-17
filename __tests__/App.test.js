import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import App from '../App';

global.fetch = jest.fn(() =>
  Promise.resolve({ ok: true, json: () => Promise.resolve([]) })
);

describe('<App />', () => {
  beforeEach(() => fetch.mockClear());

  it('renders the auth screen with login form', () => {
    const { getByText, getByPlaceholderText } = render(<App />);
    expect(getByText('Welcome Back')).toBeTruthy();
    expect(getByPlaceholderText('Username')).toBeTruthy();
    expect(getByPlaceholderText('Password')).toBeTruthy();
    expect(getByText('LOGIN')).toBeTruthy();
  });

  it('shows signup form when SIGN UP is pressed', () => {
    const { getByText, getByPlaceholderText } = render(<App />);
    // Initial mode is login, the toggle button has 'SIGN UP' in it. Let's find exactly the text or substring.
    // AuthScreen has Text "SIGN UP" within the toggle button:
    // "Don't have an account? SIGN UP"
    fireEvent.press(getByText('SIGN UP'));
    expect(getByPlaceholderText('Email')).toBeTruthy();
    expect(getByPlaceholderText('Confirm Password')).toBeTruthy();
  });

  it('navigates to feed after login with username', async () => {
    const { getByText, getByPlaceholderText } = render(<App />);
    fireEvent.changeText(getByPlaceholderText('Username'), 'Alex');
    fireEvent.changeText(getByPlaceholderText('Password'), 'pass1234');
    await act(async () => { fireEvent.press(getByText('LOGIN')); });
    expect(getByPlaceholderText('Search events...')).toBeTruthy();
  });
});
