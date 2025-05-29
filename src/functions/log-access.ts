import { PutCommand } from '@aws-sdk/lib-dynamodb'
import type { APIGatewayProxyHandler } from 'aws-lambda'
import { randomUUID } from 'node:crypto'
import { dynamo } from '../shared/dynamodb-client.js'
import { TABLE_NAME, response } from '../shared/utils.js'

interface LogAccessBody {
  appName: string
}

export const handler: APIGatewayProxyHandler = async event => {
  try {
    const { appName } = JSON.parse(event.body ?? '{}') as Partial<LogAccessBody>

    if (!appName) {
      return response(400, { message: 'appName is required' })
    }

    const accessLog: DynamoAccessLog = {
      id: randomUUID(),
      appName,
      timestamp: new Date().toISOString(),
    }

    await dynamo.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: accessLog,
      })
    )

    return response(204)
  } catch (error) {
    console.error(error)

    return response(500, { message: 'Internal Server Error' })
  }
}
