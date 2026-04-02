import React, { createContext, useState } from 'react';

export const VibeContext = createContext();

export const VibeProvider = ({ children }) => {
  const [frequency, setFrequency] = useState(0.5);

  return (
    <VibeContext.Provider value={{ frequency, setFrequency }}>
      {children}
    </VibeContext.Provider>
  );
};
