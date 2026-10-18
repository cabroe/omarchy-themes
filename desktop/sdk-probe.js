// @ts-check
// Type-checked by `make typecheck` (tsc --allowJs --checkJs --noEmit). NOT
// compiled — Hermes Desktop loads this file as plain ESM at runtime; the
// typedefs and JSDoc are consumed only by tsc. Shared shapes live in
// ./types.d.ts.
/**
 * sdk-probe.js — single source of truth for the `sdk.requestMode` probe.
 *
 * The current SDK does not export `requestMode` (defined internally in
 * apps/desktop/src/themes/request.ts, not re-exported from sdk/index.ts),
 * so this binding is `null` today. The probe runs once at module load:
 * a future SDK that re-exports `requestMode` wins automatically, today's
 * host gets the local storage-event mirror in sync.js.
 *
 * Both plugin.js and sync.js import SDK_REQUEST_MODE from here so the probe
 * lives in one place — when the SDK finally adds the export, only this
 * file needs to know.
 */
import * as sdk from '@hermes/plugin-sdk'

/** `requestMode` if the host SDK exposes it, otherwise `null`. */
/** @type {((mode: 'light' | 'dark') => void) | null} */
export const SDK_REQUEST_MODE = typeof sdk.requestMode === 'function' ? sdk.requestMode : null