/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { SendEmailCommand } from '@aws-sdk/client-ses'
import type { APIGatewayProxyHandler } from 'aws-lambda'
import { ses } from '../shared/ses-client.js'
import { response } from '../shared/utils.js'

const EMAIL_FROM = process.env.EMAIL_FROM!
const EMAIL_TO = process.env.EMAIL_TO!

interface ContactBody {
  name: string
  email: string
  subject: string
  message: string
}

export const handler: APIGatewayProxyHandler = async event => {
  try {
    const { name, email, subject, message } = JSON.parse(
      event.body ?? '{}'
    ) as DeepPartial<ContactBody>

    if (!name) {
      return response(400, { message: 'name is required' })
    }

    if (!email) {
      return response(400, { message: 'email is required' })
    }

    if (!subject) {
      return response(400, { message: 'subject is required' })
    }

    if (!message) {
      return response(400, { message: 'message is required' })
    }

    await ses.send(
      new SendEmailCommand({
        Source: EMAIL_FROM,
        Destination: { ToAddresses: [EMAIL_TO] },
        Message: {
          Subject: { Data: `Contact Form: ${subject}` },
          Body: {
            Html: {
              Data: `
<div style="font-family:Arial,Helvetica,sans-serif;color:#333;line-height:1.5;margin:0;padding:24px;">
  <h1 style="margin-top:0;color:#1e293b;">Contact Form Submission</h1>
  <p><strong>Name:</strong> ${name}</p>
  <p><strong>Email:</strong> ${email}</p>
  <p><strong>Subject:</strong> ${subject}</p>
  <p><strong>Message:</strong></p>
  <p>${message}</p>
</div>
`.trim(),
            },
          },
        },
      })
    )

    return response(200, { message: 'Message sent' })
  } catch (error) {
    console.error(error)

    return response(500, { message: 'Internal Server Error' })
  }
}
