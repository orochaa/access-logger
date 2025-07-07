/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { ScanCommand } from '@aws-sdk/lib-dynamodb'

export const dynamo = new DynamoDBClient()

export const TABLE_NAME = process.env.TABLE_NAME!

export async function getAccessLogs(
  start: Date,
  end: Date
): Promise<AccessLog[]> {
  const res = await dynamo.send(
    new ScanCommand({
      TableName: TABLE_NAME,
      FilterExpression: '#ts BETWEEN :start AND :end',
      ExpressionAttributeNames: {
        '#ts': 'timestamp',
      },
      ExpressionAttributeValues: {
        ':start': start.toISOString(),
        ':end': end.toISOString(),
      },
    })
  )

  const accessLogs = ((res.Items ?? []) as DynamoAccessLog[])
    .filter(item => !/(localhost|127\.0\.0\.1)/.test(item.meta.pageUrl))
    .map(item => ({ ...item, timestamp: new Date(item.timestamp) }))
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())

  return accessLogs
}
