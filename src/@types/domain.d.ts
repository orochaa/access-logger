interface DynamoAccessLog {
  id: string
  appName: string
  timestamp: string
}

interface AccessLog {
  id: string
  appName: string
  timestamp: Date
}
