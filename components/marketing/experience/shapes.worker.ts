/// <reference lib="webworker" />
import { buildShape, type ShapeId } from "./shapes"

// Builds the particle target sets off the main thread and hands each one back
// as soon as it is ready (buffers are transferred, not copied).
self.onmessage = (e: MessageEvent<{ ids: ShapeId[]; n: number }>) => {
  const { ids, n } = e.data
  for (const id of ids) {
    const s = buildShape(id, n)
    ;(self as unknown as Worker).postMessage({ id, pos: s.pos, col: s.col }, [s.pos.buffer, s.col.buffer])
  }
}
