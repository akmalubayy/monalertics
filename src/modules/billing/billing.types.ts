export interface SubscriptionPlan {
  id: string
  name: string
  displayName: string
  maxMonitors: number
  minIntervalSeconds: number
  retentionDays: number
  supportsTelegram: boolean
  supportsDiscord: boolean
  maxScreenshots: number
  priceMonthly: number
}

export interface SubscriptionInfo {
  planId: string
  status: 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'EXPIRED'
  startedAt: Date
  expiresAt: Date | null
}

export type BillingStatus = SubscriptionInfo['status']