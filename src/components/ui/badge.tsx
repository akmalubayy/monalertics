import { cn } from '@/lib/utils'

type BadgeVariant =
  | 'default'
  | 'up'
  | 'down'
  | 'warning'
  | 'unknown'
  | 'brand'
  | 'outline'

const variants: Record<BadgeVariant, string> = {
  default: 'bg-muted text-[var(--foreground)]',
  up: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400',
  down: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400',
  warning: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
  unknown: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  brand: 'bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-300',
  outline: 'border border-default text-muted',
}

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
  dot?: boolean
}

export function Badge({
  className,
  variant = 'default',
  dot,
  children,
  ...props
}: BadgeProps) {
  const dotColor: Record<BadgeVariant, string> = {
    default: 'bg-slate-400',
    up: 'bg-green-500',
    down: 'bg-red-500',
    warning: 'bg-amber-500',
    unknown: 'bg-slate-400',
    brand: 'bg-brand-500',
    outline: 'bg-slate-400',
  }
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
        variants[variant],
        className
      )}
      {...props}
    >
      {dot && (
        <span className={cn('h-1.5 w-1.5 rounded-full', dotColor[variant])} />
      )}
      {children}
    </span>
  )
}
