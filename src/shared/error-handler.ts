/* eslint-disable @typescript-eslint/prefer-nullish-coalescing */
import type { APIGatewayProxyResult } from 'aws-lambda'
import { sendEmail } from './ses-client.js'
import { response } from './utils.js'

async function sendErrorEmail(error: Error): Promise<void> {
  const emailBody = `
    <p>An unexpected error occurred:</p>
    <p><strong>Message:</strong> ${error.message}</p>
    <p><strong>Stack Trace:</strong></p>
    <pre>${error.stack || 'No stack trace available'}</pre>
  `

  await sendEmail('[Error] Access Logger: Unexpected Error', emailBody)
}

export async function handleError(
  error: unknown
): Promise<APIGatewayProxyResult> {
  console.error(error)

  if (error instanceof Error) {
    await sendErrorEmail(error)
  } else {
    // eslint-disable-next-line no-console
    console.warn('Error is not an instance of Error', error)
  }

  return response(500, { message: 'Internal Server Error' })
}
