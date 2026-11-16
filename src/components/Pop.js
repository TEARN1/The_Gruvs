/**
 * Pop — plays a one-shot "pop" on its children each time `trigger` changes
 * (never on first render). For like / reaction / save buttons.
 *
 *   <Pop trigger={tapCount} kind="like"><Feather name="zap" … /></Pop>
 *
 * kind: 'pop' (springy bump), 'like' (squash, burst out, settle), 'unlike'
 * (quick dip). Web uses CSS (src/styles/webFx.js) so it costs the JS thread
 * nothing; native uses one Animated spring.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, Platform, View } from 'react-native';
import { replay } from '../styles/webFx';

const IS_WEB = Platform.OS === 'web';

const WebPop = ({ trigger, kind = 'pop', style, children }) => {
  const ref = useRef(null);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    replay(ref.current, kind);
  }, [trigger, kind]);
  return <View ref={ref} style={style}>{children}</View>;
};

const PEAK = { pop: 1.25, like: 1.5, unlike: 0.72 };

const NativePop = ({ trigger, kind = 'pop', style, children }) => {
  const scale = useRef(new Animated.Value(1)).current;
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    scale.setValue(PEAK[kind] || 1.25);
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 220, friction: 6 }).start();
  }, [trigger, kind, scale]);
  return <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>;
};

export const Pop = IS_WEB ? WebPop : NativePop;
export default Pop;
