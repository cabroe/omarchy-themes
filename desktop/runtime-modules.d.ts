// Ambient declarations for the three runtime modules this plugin imports.
// Kept in a separate ambient file (`declare module` blocks aren't honored
// inside a .d.ts that also uses `export interface`/`export type`).
// Each block lists only the exports plugin.js touches; everything else
// remains `any`.
//
// Runtime host:
//   - @hermes/plugin-sdk — the desktop host's plugin SDK (real package).
//   - react / react/jsx-runtime — React (real packages).

declare module '@hermes/plugin-sdk' {
  export const THEMES_AREA: string
  export const PALETTE_AREA: string
  export const requestTheme: (name: string) => boolean | void
  export const requestMode: ((mode: 'light' | 'dark') => void) | undefined
  export const useTheme: () => { setMode: (mode: 'light' | 'dark') => void }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const Button: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const EmptyState: any
}

declare module 'react' {
  export function useState<T>(initial: T): [T, (next: T) => void]
}

declare module 'react/jsx-runtime' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const jsx: (type: any, props: any, key?: any) => any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const jsxs: (type: any, props: any, key?: any) => any
}
