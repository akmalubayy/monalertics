import { describe, it, expect } from 'vitest'
import { buildAlertTelegram } from '@/modules/alert/channels/telegram.channel'
import { buildAlertDiscord } from '@/modules/alert/channels/discord.channel'

describe('buildAlertTelegram', () => {
  const baseInput = {
    monitorName: 'My Site',
    target: 'https://example.com',
    status: 'DOWN' as const,
    message: 'Site down',
    timestamp: '2026-09-30 14:30:00',
  }

  it('should return plain text with emoji', () => {
    const text = buildAlertTelegram(baseInput)
    expect(text).toContain('🚨')
    expect(text).toContain('My Site')
    expect(text).toContain('https://example.com')
    expect(text).toContain('DOWN')
  })

  it('should use ✅ for UP', () => {
    const text = buildAlertTelegram({ ...baseInput, status: 'UP' })
    expect(text).toContain('✅')
  })

  it('should use ⚠️ for WARNING', () => {
    const text = buildAlertTelegram({ ...baseInput, status: 'WARNING' })
    expect(text).toContain('⚠️')
  })
})

describe('buildAlertDiscord', () => {
  const baseInput = {
    monitorName: 'My Site',
    target: 'https://example.com',
    status: 'DOWN' as const,
    message: 'Site down',
    timestamp: '2026-09-30 14:30:00',
  }

  it('should return Discord webhook payload with embeds', () => {
    const payload = buildAlertDiscord(baseInput)
    expect(payload).toHaveProperty('embeds')
    expect(Array.isArray(payload.embeds)).toBe(true)
    expect(payload.embeds.length).toBeGreaterThan(0)
  })

  it('should include monitor name in embed', () => {
    const payload = buildAlertDiscord(baseInput)
    const embed = payload.embeds[0]
    expect(JSON.stringify(embed)).toContain('My Site')
  })

  it('should use red color for DOWN', () => {
    const payload = buildAlertDiscord({ ...baseInput, status: 'DOWN' })
    const embed = payload.embeds[0]
    expect(embed.color).toBeGreaterThan(0)
  })
})