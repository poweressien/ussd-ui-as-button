// Copyright (c) 2026 iWEKOBONGstudios. All rights reserved. See LICENSE.
import React, { useEffect, useRef, useState } from 'react';
import { GestureResponderEvent, Pressable, PressableProps, StyleProp, StyleSheet, ViewStyle } from 'react-native';
import { colors } from '../theme';

/**
 * A Pressable that always shows it was tapped: while the finger is down it lights up green
 * and shrinks slightly, and it keeps a short green flash after release so a quick tap is
 * still visible. Use it for every button and key.
 */
export function PressableFx({ style, onPress, children, ...rest }: PressableProps): React.JSX.Element {
  const [flash, setFlash] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  const handlePress = (e: GestureResponderEvent) => {
    setFlash(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setFlash(false), 280);
    onPress?.(e);
  };

  return (
    <Pressable
      android_ripple={{ color: 'rgba(47,163,107,0.40)' }}
      {...rest}
      onPress={handlePress}
      style={(state) => {
        const base = typeof style === 'function' ? style(state) : style;
        const extra: StyleProp<ViewStyle> = [state.pressed || flash ? fx.on : null, state.pressed ? fx.down : null];
        return [base, extra];
      }}
    >
      {children}
    </Pressable>
  );
}

const fx = StyleSheet.create({
  on: { backgroundColor: 'rgba(47,163,107,0.30)', borderColor: colors.accent },
  down: { transform: [{ scale: 0.97 }] },
});
