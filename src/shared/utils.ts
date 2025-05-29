/* eslint-disable @typescript-eslint/no-non-null-assertion */
import type { APIGatewayProxyResult } from 'aws-lambda'

export const TABLE_NAME = process.env.TABLE_NAME!

export function response(
  statusCode: number,
  body?: unknown
): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  }
}
