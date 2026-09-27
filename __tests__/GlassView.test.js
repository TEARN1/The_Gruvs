import React from 'react';
import { Text } from 'react-native';
import { render } from '@testing-library/react-native';
import { ThemeProvider } from '../src/context/ThemeContext';
import { GlassView } from '../src/components/GlassView';

// Proves React Native Testing Library is wired up: render a real component tree
// and assert on what the user would see.
describe('GlassView', () => {
  it('renders its children', () => {
    const { getByText } = render(
      <ThemeProvider>
        <GlassView>
          <Text>Inside the glass</Text>
        </GlassView>
      </ThemeProvider>
    );
    expect(getByText('Inside the glass')).toBeTruthy();
  });
});
