interface ClientMetadata {
  browser: {
    name: string
    version: string
  }
  os: {
    name: string
    version: string
  }
  device: {
    type: string
    model: string
  }
  platform: string
  userAgent: string
  screen: { w: number; h: number; dpr: number }
  locale: string
  timezone: string
  referrer: string
  pageUrl: string
  clientTime: string // ISO, for drift checks
}

interface DynamoAccessLog {
  id: string
  appName: string
  timestamp: string
  meta: ClientMetadata
}

interface AccessLog {
  id: string
  appName: string
  timestamp: Date
  meta: ClientMetadata
}
