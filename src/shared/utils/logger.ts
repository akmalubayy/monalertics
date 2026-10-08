type LogLevel = 'info' | 'warn' | 'error' | 'debug'

const levelColors: Record<LogLevel, string> = {
  info: '\x1b[36m',
  warn: '\x1b[33m',
  error: '\x1b[31m',
  debug: '\x1b[90m',
}

function formatMessage(level: LogLevel, message: string): string {
  const timestamp = new Date().toISOString()
  const color = levelColors[level]
  return `${color}[${timestamp}] [${level.toUpperCase()}] ${message}\x1b[0m`
}

export const logger = {
  info: (message: string, ...args: unknown[]) => {
    console.log(formatMessage('info', message), ...args)
  },
  warn: (message: string, ...args: unknown[]) => {
    console.warn(formatMessage('warn', message), ...args)
  },
  error: (message: string, ...args: unknown[]) => {
    console.error(formatMessage('error', message), ...args)
  },
  debug: (message: string, ...args: unknown[]) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(formatMessage('debug', message), ...args)
    }
  },
}
