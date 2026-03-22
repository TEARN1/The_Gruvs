import React, { createContext, useState } from 'react';
import { View } from 'react-native';

export const VibeContext = createContext();

export const VibeProvider = ({ children }) => {
  const [frequency, setFrequency] = useState(0.5);

  return (
    <VibeContext.Provider value={{ frequency, setFrequency }}>
      <View style={{ flex: 1 }}>
        {children}
      </View>
    </VibeContext.Provider>
  );
};
