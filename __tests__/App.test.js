import React from 'react';
import {render, fireEvent, act} from '@testing-library/react-native';
import App from '../App';

describe('<App />', () => {
  it('renders without crashing', () => {
    const {getByText, getByPlaceholderText} = render(<App />);
    expect(getByText('The Gruvs')).toBeTruthy();
    expect(getByPlaceholderText('Add an event...')).toBeTruthy();
  });
});
