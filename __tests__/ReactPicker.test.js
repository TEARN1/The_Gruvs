import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ThemeProvider } from '../src/context/ThemeContext';
import { ReactPicker } from '../src/components/ReactPicker';
import { REACTION_LIST } from '../src/constants/CategoryConfig';

// ReactPicker runs continuous floating-orb animations; fake timers prevent the
// loop callbacks from firing after the test environment is torn down.
beforeEach(() => jest.useFakeTimers());
afterEach(() => { jest.clearAllTimers(); jest.useRealTimers(); });

const renderPicker = (props) =>
  render(
    <ThemeProvider>
      <ReactPicker visible onReact={() => {}} userReaction={null} {...props} />
    </ThemeProvider>
  );

describe('ReactPicker', () => {
  it('renders nothing when not visible', () => {
    const { queryByLabelText } = render(
      <ThemeProvider>
        <ReactPicker visible={false} onReact={() => {}} />
      </ThemeProvider>
    );
    // The picker is now emoji-only; "Fire" lives on accessibilityLabel.
    expect(queryByLabelText('Fire')).toBeNull();
  });

  it('renders the signature reactions when visible', () => {
    const { getByLabelText } = renderPicker();
    const fire = REACTION_LIST.find(r => r.key === 'fire');
    expect(getByLabelText(fire.label)).toBeTruthy();
  });

  it('calls onReact with the reaction key when an orb is pressed', () => {
    const onReact = jest.fn();
    const { getByLabelText } = renderPicker({ onReact });
    const fire = REACTION_LIST.find(r => r.key === 'fire');
    fireEvent.press(getByLabelText(fire.label));
    expect(onReact).toHaveBeenCalledWith('fire');
  });

  it('shows a count badge on the picked reaction', () => {
    const { getByText } = renderPicker({ userReaction: 'fire', counts: { fire: 7 } });
    expect(getByText('7')).toBeTruthy();
  });
});
