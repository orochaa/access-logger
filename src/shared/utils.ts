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
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Allow-Methods': 'GET,POST',
    },
    body: JSON.stringify(body),
  }
}

export function randomNumberBetween(n1: number, n2: number): number {
  return Math.floor(Math.random() * (n2 - n1 + 1)) + n1
}
