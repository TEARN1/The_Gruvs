import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { QuickToolsSheet } from '../src/components/QuickToolsSheet';

describe('QuickToolsSheet', () => {
  it('renders nothing when visible is false', () => {
    const { toJSON } = render(
      <QuickToolsSheet visible={false} onClose={jest.fn()} />
    );
    expect(toJSON()).toBeNull();
  });

  it('renders tools and fires callback on tap', () => {
    const onOpenRoulette = jest.fn();
    const onClose = jest.fn();

    const { getByText } = render(
      <QuickToolsSheet
        visible={true}
        onClose={onClose}
        onOpenRoulette={onOpenRoulette}
      />
    );

    expect(getByText('Explore & Tools')).toBeTruthy();
    expect(getByText('Vibe Roulette')).toBeTruthy();

    fireEvent.press(getByText('Vibe Roulette'));
    expect(onClose).toHaveBeenCalled();
    expect(onOpenRoulette).toHaveBeenCalled();
  });

  it('renders calendar and notifications when provided', () => {
    const onOpenCalendar = jest.fn();
    const onOpenNotifications = jest.fn();
    const onClose = jest.fn();

    const { getByText } = render(
      <QuickToolsSheet
        visible={true}
        onClose={onClose}
        onOpenCalendar={onOpenCalendar}
        onOpenNotifications={onOpenNotifications}
      />
    );

    expect(getByText('Lineup & Itinerary')).toBeTruthy();
    expect(getByText('Pings & Activity')).toBeTruthy();

    fireEvent.press(getByText('Lineup & Itinerary'));
    expect(onOpenCalendar).toHaveBeenCalled();
  });
});
