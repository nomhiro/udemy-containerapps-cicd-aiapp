import '@testing-library/jest-dom'

// Ignore CSS / PostCSS imports during tests
// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(global as any).CSS = { supports: () => false }

// Optional: mock matchMedia for components relying on it
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false
  })
})
