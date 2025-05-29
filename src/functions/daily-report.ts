/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { SendEmailCommand } from '@aws-sdk/client-ses'
import { ScanCommand } from '@aws-sdk/lib-dynamodb'
import type { APIGatewayProxyHandler } from 'aws-lambda'
import { dynamo } from '../shared/dynamodb-client.js'
import { ses } from '../shared/ses-client.js'
import { response } from '../shared/utils.js'

const TABLE_NAME = process.env.TABLE_NAME!
const EMAIL_FROM = process.env.EMAIL_FROM!
const EMAIL_TO = process.env.EMAIL_TO!

export const handler: APIGatewayProxyHandler = async () => {
  try {
    const now = new Date()
    const end = now.toISOString()
    const start = new Date(now.getTime() - 86_400_000).toISOString()

    const res = await dynamo.send(
      new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression: '#ts BETWEEN :start AND :end',
        ExpressionAttributeNames: {
          '#ts': 'timestamp',
        },
        ExpressionAttributeValues: {
          ':start': start,
          ':end': end,
        },
      })
    )

    const items = ((res.Items ?? []) as DynamoAccessLog[])
      .map(item => ({ ...item, timestamp: new Date(item.timestamp) }))
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
    const count = items.length

    if (count === 0) {
      return response(204)
    }

    const apps = new Map<string, AccessLog[]>()

    for (const item of items) {
      let accessList = apps.get(item.appName)

      if (!accessList) {
        accessList = []
        apps.set(item.appName, accessList)
      }

      accessList.push(item)
    }

    const mailContent = `
# Daily Access Report

Window (UTC): ${start}  →  ${end}
Count: ${count}

${[...apps]
  .map(([app, accessList]) =>
    `
## ${app}

${accessList.map(access => `* ${access.timestamp.toISOString()}`).join('\n')}
`.trim()
  )
  .join('\n')}
`.trim()

    await ses.send(
      new SendEmailCommand({
        Source: EMAIL_FROM,
        Destination: { ToAddresses: [EMAIL_TO] },
        Message: {
          Subject: { Data: `Daily Access Report` },
          Body: { Text: { Data: mailContent } },
        },
      })
    )

    return response(200, { message: 'Report sent' })
  } catch (error) {
    console.error(error)

    return response(500, { message: 'Internal Server Error' })
  }
}
