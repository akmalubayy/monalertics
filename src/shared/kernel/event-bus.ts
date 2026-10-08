type EventName = string
type EventHandler<T = unknown> = (payload: T) => void | Promise<void>

class EventBus {
  private handlers = new Map<EventName, Set<EventHandler>>()
  private onceHandlers = new Map<EventName, Set<EventHandler>>()

  on<T = unknown>(event: EventName, handler: EventHandler<T>): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set())
    }
    this.handlers.get(event)!.add(handler as EventHandler)
    return () => this.off(event, handler)
  }

  once<T = unknown>(event: EventName, handler: EventHandler<T>): () => void {
    if (!this.onceHandlers.has(event)) {
      this.onceHandlers.set(event, new Set())
    }
    this.onceHandlers.get(event)!.add(handler as EventHandler)
    return () => this.off(event, handler)
  }

  off<T = unknown>(event: EventName, handler: EventHandler<T>): void {
    this.handlers.get(event)?.delete(handler as EventHandler)
    this.onceHandlers.get(event)?.delete(handler as EventHandler)
  }

  async emit<T = unknown>(event: EventName, payload: T): Promise<void> {
    const promises: Promise<void>[] = []

    const regularHandlers = this.handlers.get(event)
    if (regularHandlers) {
      for (const handler of regularHandlers) {
        promises.push(Promise.resolve(handler(payload)))
      }
    }

    const onceHandlers = this.onceHandlers.get(event)
    if (onceHandlers) {
      for (const handler of onceHandlers) {
        promises.push(Promise.resolve(handler(payload)))
      }
      onceHandlers.clear()
    }

    await Promise.allSettled(promises)
  }
}

export const eventBus = new EventBus()

// Event names (typed constants)
export const EVENTS = {
  MONITOR_STATUS_CHANGED: 'monitor.status_changed',
  MONITOR_CHECK_COMPLETED: 'monitor.check_completed',
  INCIDENT_STARTED: 'incident.started',
  INCIDENT_RESOLVED: 'incident.resolved',
  SCREENSHOT_REQUESTED: 'screenshot.requested',
  ALERT_REQUESTED: 'alert.requested',
} as const
