import { createConnection } from 'net'

export interface DomainInfo {
  domain: string
  expiryDate: Date | null
  registrar?: string
  raw?: string
}

// RDAP servers per TLD (HTTP-based, lebih reliable dari port 43)
const RDAP_SERVERS: Record<string, string> = {
  'id': 'https://rdap.pandi.id/rdap/',
  'co.id': 'https://rdap.pandi.id/rdap/',
  'web.id': 'https://rdap.pandi.id/rdap/',
  'my.id': 'https://rdap.pandi.id/rdap/',
  'net.id': 'https://rdap.pandi.id/rdap/',
  'org.id': 'https://rdap.pandi.id/rdap/',
  'ac.id': 'https://rdap.pandi.id/rdap/',
  'sch.id': 'https://rdap.pandi.id/rdap/',
  'biz.id': 'https://rdap.pandi.id/rdap/',
  'com': 'https://rdap.verisign.com/com/v1/',
  'net': 'https://rdap.verisign.com/net/v1/',
  'org': 'https://rdap.rdap.org/', // fallback IANA RDAP bootstrap
  'my': 'https://rdap.mynic.my/rdap/',
  'com.my': 'https://rdap.mynic.my/rdap/',
}

// WHOIS servers per TLD (port 43, fallback)
const WHOIS_SERVERS: Record<string, string> = {
  'id': 'whois.pandi.or.id',
  'co.id': 'whois.pandi.or.id',
  'web.id': 'whois.pandi.or.id',
  'my.id': 'whois.pandi.or.id',
  'net.id': 'whois.pandi.or.id',
  'org.id': 'whois.pandi.or.id',
  'ac.id': 'whois.pandi.or.id',
  'sch.id': 'whois.pandi.or.id',
  'biz.id': 'whois.pandi.or.id',
  'com': 'whois.verisign-grs.com',
  'net': 'whois.verisign-grs.com',
  'org': 'whois.pir.org',
  'co.uk': 'whois.nic.uk',
  'uk': 'whois.nic.uk',
  'de': 'whois.denic.de',
  'fr': 'whois.afnic.fr',
  'ru': 'whois.tcinet.ru',
  'cn': 'whois.cnnic.cn',
  'my': 'whois.mynic.my',
  'com.my': 'whois.mynic.my',
}

function getTld(domain: string): string {
  const parts = domain.split('.')
  const tld = parts.slice(-2).join('.')
  return tld in RDAP_SERVERS ? tld : parts[parts.length - 1]
}

// ==================== RDAP (Primary) ====================

interface RdapEvent {
  eventAction: string
  eventDate: string
}

interface RdapEntity {
  vcardArray?: Array<[string, Array<[string, unknown, string, string]>]>
  roles?: string[]
}

interface RdapResponse {
  ldhName?: string
  events?: RdapEvent[]
  entities?: RdapEntity[]
  status?: string[]
  errorCode?: number
  title?: string
}

async function queryRdap(domain: string): Promise<DomainInfo> {
  const tld = getTld(domain)
  const baseUrl = RDAP_SERVERS[tld] || `https://rdap.rdap.org/`
  const url = `${baseUrl}domain/${domain}`

  const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
  if (!res.ok) throw new Error(`RDAP HTTP ${res.status}`)

  const data = await res.json() as RdapResponse

  // Cek error response
  if (data.errorCode || data.title === 'Not Found') {
    throw new Error(`Domain tidak ditemukan di RDAP`)
  }

  // Extract expiration date dari events array
  let expiryDate: Date | null = null
  for (const event of data.events ?? []) {
    if (event.eventAction === 'expiration' || event.eventAction === 'exp') {
      const d = new Date(event.eventDate)
      if (!isNaN(d.getTime())) {
        expiryDate = d
        break
      }
    }
  }

  // Extract registrar dari entities
  let registrar: string | undefined
  for (const entity of data.entities ?? []) {
    if (entity.roles?.includes('registrar')) {
      // Parse vCard untuk nama registrar
      if (entity.vcardArray?.[1]) {
        for (const prop of entity.vcardArray[1]) {
          if (prop[0] === 'fn' && typeof prop[3] === 'string') {
            registrar = prop[3]
            break
          }
        }
      }
      if (!registrar) {
        // Fallback: ambil handle atau first role
        registrar = 'Unknown Registrar'
      }
      break
    }
  }

  return {
    domain,
    expiryDate,
    registrar,
    raw: JSON.stringify(data).slice(0, 500),
  }
}

// ==================== WHOIS Socket (Fallback) ====================

// Patterns untuk parse expiry date dari berbagai WHOIS server
const EXPIRY_PATTERNS = [
  /Registry Expiry Date:\s*(.+)/i,
  /Registrar Registration Expiration Date:\s*(.+)/i,
  /Expiration Date:\s*(.+)/i,
  /Expiry Date:\s*(.+)/i,
  /expire:\s*(.+)/i,
  /paid-till:\s*(.+)/i,
  /\bExpiration\s+Date:\s*(.+)/i,
  /Domain Expires:\s*(.+)/i,
  /Expired On\s*:\s*(.+)/i,
  /Expiration Time\s*:\s*(.+)/i,
]

function getWhoisServer(domain: string): string {
  const tld = getTld(domain)
  return WHOIS_SERVERS[tld] || 'whois.iana.org'
}

async function queryWhoisSocket(domain: string, server: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const socket = createConnection({ host: server, port: 43 })
    let data = ''

    socket.setTimeout(15000)
    socket.on('connect', () => {
      socket.write(`${domain}\r\n`)
    })
    socket.on('data', (chunk) => {
      data += chunk.toString()
    })
    socket.on('end', () => resolve(data))
    socket.on('error', reject)
    socket.on('timeout', () => {
      socket.destroy()
      reject(new Error('WHOIS timeout'))
    })
  })
}

function parseExpiryDateFromText(text: string): Date | null {
  for (const pattern of EXPIRY_PATTERNS) {
    const match = text.match(pattern)
    if (match?.[1]) {
      let dateStr = match[1].trim().split(/[\n,]/)[0].trim()
      const date = new Date(dateStr)
      if (!isNaN(date.getTime())) {
        const diff = date.getTime() - Date.now()
        if (diff > -315360000000) return date
      }
    }
  }
  return null
}

function parseRegistrarFromText(text: string): string | undefined {
  const match = text.match(/Registrar:\s*(.+)/i)
  return match?.[1]?.trim().slice(0, 200)
}

// ==================== Main Export ====================

export async function getDomainExpiry(domain: string): Promise<DomainInfo> {
  const cleanDomain = domain
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.*$/, '')
    .replace(/:\d+$/, '')
    .trim()
    .toLowerCase()

  if (!cleanDomain.includes('.') || cleanDomain.startsWith('.')) {
    throw new Error(`Domain "${cleanDomain}" tidak valid`)
  }

  // Strategy 1: RDAP via HTTP (primary — paling reliable)
  try {
    return await queryRdap(cleanDomain)
  } catch (rdapErr) {
    console.log(`RDAP failed for ${cleanDomain}, trying WHOIS socket...`, rdapErr instanceof Error ? rdapErr.message : rdapErr)
  }

  // Strategy 2: WHOIS via socket port 43 (fallback)
  try {
    const server = getWhoisServer(cleanDomain)
    const whoisData = await queryWhoisSocket(cleanDomain, server)
    const expiryDate = parseExpiryDateFromText(whoisData)
    const registrar = parseRegistrarFromText(whoisData)

    if (expiryDate) {
      return { domain: cleanDomain, expiryDate, registrar, raw: whoisData.slice(0, 500) }
    }

    // Data ada tapi tidak bisa parse expiry — lanjut ke HTTP WHOIS
    console.log(`WHOIS socket got data but could not parse expiry for ${cleanDomain}`)
  } catch (socketErr) {
    console.log(`WHOIS socket failed for ${cleanDomain}`, socketErr instanceof Error ? socketErr.message : socketErr)
  }

  // Strategy 3: HTTP WHOIS fallback (untuk domain yang tidak punya RDAP)
  try {
    return await fetchWhoisHttp(cleanDomain)
  } catch (httpErr) {
    console.log(`HTTP WHOIS failed for ${cleanDomain}`, httpErr instanceof Error ? httpErr.message : httpErr)
  }

  // Semua strategi gagal
  throw new Error(
    `Gagal mendapatkan info domain "${cleanDomain}". RDAP, WHOIS socket, dan HTTP WHOIS semuanya tidak tersedia.`
  )
}

// ==================== HTTP WHOIS Fallback ====================

async function fetchWhoisHttp(domain: string): Promise<DomainInfo> {
  const sources = [
    `https://whois.domaintools.com/${domain}`,
    `https://www.whois.com/whois/${domain}`,
    `https://who.is/whois/${domain}`,
  ]

  for (const url of sources) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
      if (!res.ok) continue

      const html = await res.text()
      if (!html || html.length < 100) continue

      // Extract pre tag jika ada
      let textContent = html
      const preMatch = html.match(/<pre[^>]*>([\s\S]+?)<\/pre>/i)
      if (preMatch) {
        textContent = preMatch[1]
      } else {
        // Fallback: strip HTML tags
        textContent = html.replace(/<[^>]*>/g, '\n')
      }

      // Parse expiry date
      const expiryDate = parseExpiryDateFromText(textContent)
      const registrar = parseRegistrarFromText(textContent)

      if (expiryDate) {
        return { domain, expiryDate, registrar, raw: textContent.slice(0, 500) }
      }

      // Jika dapat data tapi tidak bisa parse expiry, return dengan expiryDate null
      // (bukan throw, karena mungkin sumber lain berhasil)
    } catch {
      // Coba sumber berikutnya
    }
  }

  // Semua sumber HTTP WHOIS gagal
  throw new Error(`Tidak dapat mengakses HTTP WHOIS untuk "${domain}"`)
}
