'use client';

import { useEffect, useState } from 'react';
import {
  createDOMRenderer,
  RendererProvider,
  FluentProvider,
  webLightTheme,
  SSRProvider,
  Theme,
} from '@fluentui/react-components';

const renderer = createDOMRenderer();

// ✅ Ethio Telecom custom green theme — type-safe for Fluent UI v9
const ethioTelecomTheme: Theme = {
  ...webLightTheme,

  // Brand colors
  colorBrandBackground: '#8DC63F',
  colorBrandBackgroundHover: '#7AB330',
  colorBrandBackgroundPressed: '#6AA12A',

  // Foreground (text, icons, etc.)
  colorBrandForeground1: '#8DC63F',
  colorBrandForegroundLink: '#8DC63F',
  colorBrandForegroundLinkHover: '#7AB330',
  colorBrandForeground2: '#8DC63F',
  colorBrandForeground2Hover: '#7AB330',

  // Border/stroke colors
  colorBrandStroke1: '#8DC63F',
  colorBrandStroke2: '#6AA12A',
};

/**
 * Providers component.
 * Wraps the app with Fluent UI’s Renderer, SSR, and Theme providers.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  if (!hasMounted) return null;

  return (
    <RendererProvider renderer={renderer || createDOMRenderer()}>
      <SSRProvider>
        {/* 🌿 Global Ethio Telecom theme */}
        <FluentProvider theme={ethioTelecomTheme}>
          {children}
        </FluentProvider>
      </SSRProvider>
    </RendererProvider>
  );
}
