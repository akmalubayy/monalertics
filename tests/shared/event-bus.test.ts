import { describe, it, expect, vi } from 'vitest'
import { eventBus, EVENTS } from '@/shared/kernel/event-bus'

describe('EventBus', () => {
  it('should call handler when event is emitted', async () => {
    const handler = vi.fn()
    eventBus.on(EVENTS.MONITOR_STATUS_CHANGED, handler)

    await eventBus.emit(EVENTS.MONITOR_STATUS_CHANGED, { foo: 'bar' })

    expect(handler).toHaveBeenCalledWith({ foo: 'bar' })
  })

  it('should support multiple handlers for same event', async () => {
    const h1 = vi.fn()
    const h2 = vi.fn()
    eventBus.on('test.event', h1)
    eventBus.on('test.event', h2)

    await eventBus.emit('test.event', 'payload')

    expect(h1).toHaveBeenCalledWith('payload')
    expect(h2).toHaveBeenCalledWith('payload')
  })

  it('should call once handlers only once', async () => {
    const handler = vi.fn()
    eventBus.once('test.once', handler)

    await eventBus.emit('test.once', 1)
    await eventBus.emit('test.once', 2)

    expect(handler).toHaveBeenCalledTimes(1)
    expect(handler).toHaveBeenCalledWith(1)
  })

  it('should support unsubscribing via off', async () => {
    const handler = vi.fn()
    eventBus.on('test.unsub', handler)
    eventBus.off('test.unsub', handler)

    await eventBus.emit('test.unsub', {})

    expect(handler).not.toHaveBeenCalled()
  })

  it('should support unsubscribing via returned function', async () => {
    const handler = vi.fn()
    const unsub = eventBus.on('test.unsub2', handler)
    unsub()

    await eventBus.emit('test.unsub2', {})

    expect(handler).not.toHaveBeenCalled()
  })

  it('should not throw when emitting event with no handlers', async () => {
    await expect(eventBus.emit('test.nonexistent', {})).resolves.not.toThrow()
  })

  it('should call all handlers even if one throws (via allSettled)', async () => {
    const ok = vi.fn()
    const bad = vi.fn().mockRejectedValue(new Error('boom'))
    eventBus.on('test.mixed', ok)
    eventBus.on('test.mixed', bad)

    await expect(eventBus.emit('test.mixed', {})).resolves.not.toThrow()
    expect(ok).toHaveBeenCalled()
    expect(bad).toHaveBeenCalled()
  })
})