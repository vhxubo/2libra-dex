import '@testing-library/jest-dom/vitest'

// jsdom 缺少 Radix 组件依赖的浏览器 API，补齐最小桩实现
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

if (typeof window !== 'undefined' && !window.ResizeObserver) {
  window.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver
}

// worker/ 下的测试跑在 node 环境（无 jsdom），DOM 桩仅在浏览器环境补齐
if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {}
}
