import nodemailer from 'nodemailer'
import type { Transporter } from 'nodemailer'
import { env } from '@/shared/config/env'
import { logger } from '@/shared/utils/logger'

export interface EmailPayload {
  to: string
  subject: string
  html: string
  text?: string
}

let transporter: Transporter | null = null

function getTransporter(): Transporter {
  if (!transporter) {
    if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASSWORD) {
      throw new Error('SMTP not configured')
    }
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
    })
  }
  return transporter
}

export async function sendEmail(payload: EmailPayload): Promise<boolean> {
  try {
    const transport = getTransporter()
    await transport.sendMail({
      from: env.SMTP_FROM,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
    })
    logger.info(`Email sent to ${payload.to}: ${payload.subject}`)
    return true
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : JSON.stringify(err)
    logger.error(`Email send failed to ${payload.to}: ${errorMsg}`, err)
    console.error('[SMTP Error]', {
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      user: env.SMTP_USER,
      to: payload.to,
      error: errorMsg,
    })
    return false
  }
}

export function buildAlertEmail(data: {
  monitorName: string
  target: string
  status: 'UP' | 'DOWN' | 'WARNING'
  message: string
  timestamp: string
  screenshotUrl?: string
}): { subject: string; html: string; text: string } {
  const emoji = data.status === 'DOWN' ? '🚨' : data.status === 'UP' ? '✅' : '⚠️'
  const statusText = data.status === 'DOWN' ? 'DOWN' : data.status === 'UP' ? 'UP' : 'WARNING'

  const subject = `${emoji} [Monalertics] ${data.monitorName} is ${statusText}`
  const text = `
${subject}

Monitor: ${data.monitorName}
Target: ${data.target}
Status: ${statusText}
Message: ${data.message}
Time: ${data.timestamp}

---
Monalertics - Website & Domain Monitoring
  `.trim()

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: ${data.status === 'DOWN' ? '#dc2626' : data.status === 'UP' ? '#16a34a' : '#d97706'}; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb; border-top: none; }
    .field { margin: 12px 0; }
    .label { font-weight: 600; color: #4b5563; }
    .value { font-family: monospace; background: white; padding: 8px 12px; border-radius: 4px; display: inline-block; margin-top: 4px; }
    .screenshot { margin-top: 16px; }
    .footer { margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #9ca3af; text-align: center; }
  </style>
</head>
<body>
  <div class="header">
    <h1 style="margin: 0; font-size: 20px;">${subject}</h1>
  </div>
  <div class="content">
    <div class="field"><span class="label">Monitor</span><br><span class="value">${data.monitorName}</span></div>
    <div class="field"><span class="label">Target</span><br><span class="value">${data.target}</span></div>
    <div class="field"><span class="label">Status</span><br><span class="value">${statusText}</span></div>
    <div class="field"><span class="label">Message</span><br><span class="value">${data.message}</span></div>
    <div class="field"><span class="label">Time</span><br><span class="value">${data.timestamp}</span></div>
    ${data.screenshotUrl ? `<div class="screenshot"><img src="${data.screenshotUrl}" alt="Screenshot" style="max-width: 100%; border-radius: 4px; border: 1px solid #e5e7eb;"></div>` : ''}
  </div>
  <div class="footer">Monalertics — Website, Domain & SSL Monitoring</div>
</body>
</html>
  `.trim()

  return { subject, html, text }
}