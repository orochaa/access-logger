import { PutCommand } from '@aws-sdk/lib-dynamodb'
import type { APIGatewayProxyHandler } from 'aws-lambda'
import { randomUUID } from 'node:crypto'
import { dynamo } from '../shared/dynamodb-client.js'
import { handleError } from '../shared/error-handler.js'
import { TABLE_NAME, response } from '../shared/utils.js'

interface LogAccessBody {
  appName: string
  meta: ClientMetadata
}

export const handler: APIGatewayProxyHandler = async event => {
  try {
    const { appName, meta } = JSON.parse(
      event.body ?? '{}'
    ) as DeepPartial<LogAccessBody>

    if (!appName) {
      return response(400, { message: 'appName is required' })
    }

    if (!meta) {
      return response(400, { message: 'meta is required' })
    }

    if (
      typeof meta.browser !== 'object' ||
      typeof meta.browser.name !== 'string' ||
      typeof meta.browser.version !== 'string' ||
      typeof meta.os !== 'object' ||
      typeof meta.os.name !== 'string' ||
      typeof meta.os.version !== 'string' ||
      typeof meta.device !== 'object' ||
      typeof meta.device.type !== 'string' ||
      typeof meta.device.model !== 'string' ||
      typeof meta.platform !== 'string' ||
      typeof meta.userAgent !== 'string' ||
      typeof meta.screen !== 'object' ||
      typeof meta.screen.w !== 'number' ||
      typeof meta.screen.h !== 'number' ||
      typeof meta.screen.dpr !== 'number' ||
      typeof meta.locale !== 'string' ||
      typeof meta.timezone !== 'string' ||
      typeof meta.referrer !== 'string' ||
      typeof meta.pageUrl !== 'string' ||
      typeof meta.clientTime !== 'string'
    ) {
      return response(400, { message: 'Invalid meta object structure' })
    }

    const accessLog: DynamoAccessLog = {
      id: randomUUID(),
      appName,
      timestamp: new Date().toISOString(),
      meta: meta as ClientMetadata,
    }

    await dynamo.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: accessLog,
      })
    )

    return response(201)
  } catch (error) {
    return handleError(error)
  }
}
