import { initializeModules } from '@/modules/init'

initializeModules()

export async function register() {
  // Next.js instrumentation hook — dijalankan sekali saat server start.
  initializeModules()
}
