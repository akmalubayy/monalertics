import 'server-only'
import { logger } from '@/shared/utils/logger'

// Import modules yang punya side-effect (event listener registration)
// agar listener aktif saat aplikasi boot.
import '@/modules/alert/alert.service'

let initialized = false

export function initializeModules() {
  if (initialized) return
  initialized = true
  logger.info('🟢 Monalertics modules initialized')
}
