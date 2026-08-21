import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Platform } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useTheme } from '../context/ThemeContext';

/**
 * CollapsibleSection — a tappable header that shows/hides its children.
 * Used to de-clutter long screens (e.g. the profile) into scannable groups.
 */
export const CollapsibleSection = ({ title, icon = 'star', defaultOpen = true, primary: primaryProp, children }) => {
  const { currentTheme } = useTheme();
  const primary = primaryProp || currentTheme?.primary || '#00f2ff';
  const text = currentTheme?.text || '#fff';
  const [open, setOpen] = useState(defaultOpen);

  return (
    <View style={{ marginBottom: 6 }}>
      <TouchableOpacity
        onPress={() => setOpen(o => !o)}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`${open ? 'Collapse' : 'Expand'} ${title}`}
        style={{
          flexDirection: 'row', alignItems: 'center', gap: 9,
          marginHorizontal: 16, marginTop: 10, marginBottom: 6,
          paddingVertical: 11, paddingHorizontal: 14,
          borderRadius: 14, borderWidth: 1,
          borderColor: `${primary}22`, backgroundColor: `${primary}0A`,
          ...(Platform.OS === 'web' ? { cursor: 'pointer' } : {}),
        }}
      >
        <Feather name={icon} size={14} color={primary} />
        <Text style={{ color: text, fontSize: 12, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase', flex: 1 }}>
          {title}
        </Text>
        <Feather name={open ? 'chevron-up' : 'chevron-down'} size={18} color={primary} />
      </TouchableOpacity>
      {open ? <View>{children}</View> : null}
    </View>
  );
};

export default CollapsibleSection;
