import * as tls from 'tls'

export interface SSLInfo {
  hostname: string
  validFrom: Date
  validTo: Date
  issuer: string
  subject: string
}

export async function getSSLExpiry(hostname: string, port = 443): Promise<SSLInfo | null> {
  const host = hostname.replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/:\d+$/, '')

  return new Promise((resolve, reject) => {
    const socket = tls.connect(
      {
        host,
        port,
        rejectUnauthorized: false, // ambil info walau self-signed
        servername: host,
        timeout: 10000,
      },
      () => {
        const cert = socket.getPeerCertificate(true)
        if (!cert || !cert.valid_to) {
          socket.destroy()
          reject(new Error('Failed to retrieve certificate'))
          return
        }
        const cn = Array.isArray(cert.subject?.CN) ? cert.subject.CN[0] : cert.subject?.CN
        const issuerO = Array.isArray(cert.issuer?.O) ? cert.issuer.O[0] : cert.issuer?.O
        const issuerCN = Array.isArray(cert.issuer?.CN) ? cert.issuer.CN[0] : cert.issuer?.CN
        const info: SSLInfo = {
          hostname: host,
          validFrom: new Date(cert.valid_from),
          validTo: new Date(cert.valid_to),
          issuer: issuerO || issuerCN || 'Unknown',
          subject: cn || host,
        }
        socket.destroy()
        resolve(info)
      }
    )

    socket.on('error', (err) => {
      reject(new Error(`SSL connection failed: ${err.message}`))
    })
    socket.on('timeout', () => {
      socket.destroy()
      reject(new Error('SSL connection timed out'))
    })
  })
}
