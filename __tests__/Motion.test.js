import React from 'react';
import { Text } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import { AnimatedCounter, PressableScale } from '../src/components/Motion';

// These components run continuous/spring Animated effects. Fake timers keep
// those animation callbacks from firing after the test environment is torn down.
beforeEach(() => jest.useFakeTimers());
afterEach(() => { jest.clearAllTimers(); jest.useRealTimers(); });

describe('AnimatedCounter', () => {
  it('renders the value', () => {
    const { getByText } = render(<AnimatedCounter value={42} />);
    expect(getByText('42')).toBeTruthy();
  });

  it('supports a custom formatter', () => {
    const { getByText } = render(<AnimatedCounter value={5} format={(n) => `${n} vibes`} />);
    expect(getByText('5 vibes')).toBeTruthy();
  });
});

describe('PressableScale', () => {
  it('fires onPress when pressed', () => {
    const onPress = jest.fn();
    const { getByText } = render(
      <PressableScale onPress={onPress}><Text>Tap me</Text></PressableScale>
    );
    fireEvent.press(getByText('Tap me'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not fire onPress when disabled', () => {
    const onPress = jest.fn();
    const { getByText } = render(
      <PressableScale onPress={onPress} disabled><Text>No tap</Text></PressableScale>
    );
    fireEvent.press(getByText('No tap'));
    expect(onPress).not.toHaveBeenCalled();
  });
});
