/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { SESClient } from '@aws-sdk/client-ses'
import { SendEmailCommand } from '@aws-sdk/client-ses'

const ses = new SESClient({ region: 'us-east-1' })

const EMAIL_FROM = process.env.EMAIL_FROM!
const EMAIL_TO = process.env.EMAIL_TO!

export async function sendEmail(
  subject: string,
  htmlBody: string
): Promise<void> {
  await ses.send(
    new SendEmailCommand({
      Source: EMAIL_FROM,
      Destination: { ToAddresses: [EMAIL_TO] },
      Message: {
        Subject: { Data: subject },
        Body: { Html: { Data: htmlBody } },
      },
    })
  )
}
