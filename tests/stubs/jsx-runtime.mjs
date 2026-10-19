// Reads `props.key` like React 19 (jsxProd: `void 0 !== config.key`), so a
// `jsx(Comp)` without a props object throws the same TypeError as the renderer.
export const jsx = (type, props, key) => ({ type, props, key: key ?? props.key ?? null })
export const jsxs = jsx
