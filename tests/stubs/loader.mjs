// Node module-resolution hook (sync, works with registerHooks and register): map the three specifiers the Hermes Desktop
// renderer provides at runtime onto local stubs.
const STUBS = {
  '@hermes/plugin-sdk': './sdk.mjs',
  'react': './react.mjs',
  'react/jsx-runtime': './jsx-runtime.mjs',
}

export function resolve(specifier, context, next) {
  if (specifier in STUBS) {
    return { url: new URL(STUBS[specifier], import.meta.url).href, shortCircuit: true }
  }
  return next(specifier, context)
}
