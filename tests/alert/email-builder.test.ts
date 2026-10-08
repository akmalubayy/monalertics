import { describe, it, expect } from 'vitest'
import { buildAlertEmail } from '@/modules/alert/channels/email.channel'

describe('buildAlertEmail', () => {
  const baseInput = {
    monitorName: 'My Site',
    target: 'https://example.com',
    status: 'DOWN' as const,
    message: 'Connection refused',
    timestamp: '2026-09-30 14:30:00',
  }

  it('should include emoji + status in subject', () => {
    const result = buildAlertEmail(baseInput)
    expect(result.subject).toBe('🚨 [Monalertics] My Site is DOWN')
  })

  it('should use ✅ for UP', () => {
    const result = buildAlertEmail({ ...baseInput, status: 'UP' })
    expect(result.subject).toContain('✅')
    expect(result.subject).toContain('UP')
  })

  it('should use ⚠️ for WARNING', () => {
    const result = buildAlertEmail({ ...baseInput, status: 'WARNING' })
    expect(result.subject).toContain('⚠️')
    expect(result.subject).toContain('WARNING')
  })

  it('should produce plain-text content', () => {
    const result = buildAlertEmail(baseInput)
    expect(result.text).toContain('My Site')
    expect(result.text).toContain('https://example.com')
    expect(result.text).toContain('DOWN')
    expect(result.text).toContain('Connection refused')
  })

  it('should produce HTML content with proper structure', () => {
    const result = buildAlertEmail(baseInput)
    expect(result.html).toContain('<!DOCTYPE')
    expect(result.html).toContain('<html>')
    expect(result.html).toContain('My Site')
    expect(result.html).toContain('DOWN')
  })

  it('should include screenshot when screenshotUrl provided', () => {
    const result = buildAlertEmail({ ...baseInput, screenshotUrl: 'https://cdn.example.com/shot.png' })
    expect(result.html).toContain('https://cdn.example.com/shot.png')
    expect(result.html).toContain('<img')
  })

  it('should NOT include screenshot tag when no URL', () => {
    const result = buildAlertEmail(baseInput)
    expect(result.html).not.toContain('<img')
  })

  it('should return all three fields', () => {
    const result = buildAlertEmail(baseInput)
    expect(result).toHaveProperty('subject')
    expect(result).toHaveProperty('html')
    expect(result).toHaveProperty('text')
  })
})