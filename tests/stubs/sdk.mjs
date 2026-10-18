// Minimal stand-in for @hermes/plugin-sdk — only what plugin.js imports.
// Real SDK exports a ThemeProvider-backed useContext; the stub returns a
// fixed object so ThemeCard.apply onClick can invoke setMode without React.
// `requested` records requestTheme() calls for the smoke test.
export const THEMES_AREA = 'themes'
export const PALETTE_AREA = 'palette'
export const requested = []
export const requestTheme = name => { requested.push(name); return true }
export const useTheme = () => ({ setMode: () => true })
export const Button = () => null
export const EmptyState = () => null
