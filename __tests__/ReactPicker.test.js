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
    const { queryByText } = render(
      <ThemeProvider>
        <ReactPicker visible={false} onReact={() => {}} />
      </ThemeProvider>
    );
    // "Fire" is the label of the first signature reaction; absent when hidden
    expect(queryByText('Fire')).toBeNull();
  });

  it('renders the signature reactions when visible', () => {
    const { getByText } = renderPicker();
    const fireLabel = REACTION_LIST.find(r => r.key === 'fire')?.label || 'Fire';
    expect(getByText(fireLabel)).toBeTruthy();
  });

  it('calls onReact with the reaction key when an orb is pressed', () => {
    const onReact = jest.fn();
    const { getByText } = renderPicker({ onReact });
    const fire = REACTION_LIST.find(r => r.key === 'fire');
    fireEvent.press(getByText(fire.label));
    expect(onReact).toHaveBeenCalledWith('fire');
  });
});
