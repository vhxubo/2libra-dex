/** gifenc 未随包发布类型声明，这里按 1.0.x 实际 API 手写最小声明。 */
declare module 'gifenc' {
  export interface GifWriteFrameOptions {
    palette?: number[][]
    first?: boolean
    transparent?: boolean
    transparentIndex?: number
    /** 帧时长（ms），内部换算为 GIF 的百分之一秒单位。 */
    delay?: number
    /** 0 表示无限循环。 */
    repeat?: number
    dispose?: number
  }

  export interface GifEncoderInstance {
    writeFrame(
      index: Uint8Array,
      width: number,
      height: number,
      options?: GifWriteFrameOptions,
    ): void
    finish(): void
    bytes(): Uint8Array
    bytesView(): Uint8Array
    reset(): void
  }

  export function GIFEncoder(options?: {
    auto?: boolean
    initialCapacity?: number
  }): GifEncoderInstance

  export function quantize(
    rgba: Uint8ClampedArray | Uint8Array,
    maxColors: number,
    options?: { format?: string; oneBitAlpha?: boolean; clearAlpha?: boolean },
  ): number[][]

  export function applyPalette(
    rgba: Uint8ClampedArray | Uint8Array,
    palette: number[][],
    format?: string,
  ): Uint8Array
}
