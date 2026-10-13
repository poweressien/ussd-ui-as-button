// Copyright (c) 2026 iWEKOBONGstudios. All rights reserved. See LICENSE.
import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

/**
 * A deliberately small stack navigator. This app has five screens and no
 * deep-linking requirements, so a Context + array-based history avoids
 * pulling in @react-navigation (which brings react-native-screens,
 * safe-area-context, and gesture-handler as native-linked dependencies) for
 * navigation logic this simple. Swap in React Navigation later if the app
 * grows past this — nothing here assumes a particular navigation library.
 */
export type RouteName = 'Home' | 'Session' | 'SimSelector' | 'Settings' | 'Developer' | 'Consent' | 'About';

interface NavContextValue {
  route: RouteName;
  navigate: (route: RouteName) => void;
  goBack: () => void;
  canGoBack: boolean;
}

const NavContext = createContext<NavContextValue | null>(null);

export function NavigationProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [stack, setStack] = useState<RouteName[]>(['Home']);

  const navigate = useCallback((route: RouteName) => {
    setStack((prev) => [...prev, route]);
  }, []);

  const goBack = useCallback(() => {
    setStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
  }, []);

  const value = useMemo<NavContextValue>(
    () => ({ route: stack[stack.length - 1], navigate, goBack, canGoBack: stack.length > 1 }),
    [stack, navigate, goBack]
  );

  return <NavContext.Provider value={value}>{children}</NavContext.Provider>;
}

export function useNavigation(): NavContextValue {
  const ctx = useContext(NavContext);
  if (!ctx) throw new Error('useNavigation() must be used inside a <NavigationProvider>');
  return ctx;
}
