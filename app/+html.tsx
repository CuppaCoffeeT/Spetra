import { ScrollViewStyleReset } from 'expo-router/html';
import type { ReactNode } from 'react';

// Web-only: configures the root HTML for every web page (static rendering).
// Runs in Node during build — no DOM/browser APIs here.
export default function Root({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <title>Spend Tracker</title>
        {/* Disable body scroll on web so ScrollView behaves like native. */}
        <ScrollViewStyleReset />
        {/* Avoid a background-color flicker before JS hydrates (light/dark). */}
        <style dangerouslySetInnerHTML={{ __html: responsiveBackground }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

const responsiveBackground = `
body { background-color: #fafaf9; }
@media (prefers-color-scheme: dark) {
  body { background-color: #0c0a09; }
}`;
