export interface ScreenshotResult {
  success: boolean
  imageBase64?: string
  imageBuffer?: Buffer
  error?: string
}

export interface ScreenshotProvider {
  readonly name: string
  capture(url: string, options?: { width?: number; height?: number }): Promise<ScreenshotResult>
}
