/* eslint-disable @typescript-eslint/prefer-nullish-coalescing */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { SendEmailCommand } from '@aws-sdk/client-ses'
import type { APIGatewayProxyResult } from 'aws-lambda'
import { ses } from './ses-client.js'
import { response } from './utils.js'

const EMAIL_FROM = process.env.EMAIL_FROM!
const EMAIL_TO = process.env.EMAIL_TO!

async function sendErrorEmail(error: Error): Promise<void> {
  const emailBody = `
    <p>An unexpected error occurred:</p>
    <p><strong>Message:</strong> ${error.message}</p>
    <p><strong>Stack Trace:</strong></p>
    <pre>${error.stack || 'No stack trace available'}</pre>
  `

  await ses.send(
    new SendEmailCommand({
      Source: EMAIL_FROM,
      Destination: { ToAddresses: [EMAIL_TO] },
      Message: {
        Subject: { Data: '[Error] Access Logger: Unexpected Error' },
        Body: { Html: { Data: emailBody } },
      },
    })
  )
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
