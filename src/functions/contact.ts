import type { APIGatewayProxyHandler } from 'aws-lambda'
import { handleError } from '../shared/error-handler.js'
import { getRandomGifUrl } from '../shared/gif.js'
import { sendEmail } from '../shared/ses-client.js'
import { response } from '../shared/utils.js'

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

    const randomGifUrl = await getRandomGifUrl()

    const htmlBody = `
<div style="font-family:Arial,Helvetica,sans-serif;color:#333;line-height:1.5;margin:0;padding:24px;">
  <img src="${randomGifUrl}" alt="Celebration GIF" style="margin: 0 24px; max-width: 100%; height: auto;" />
  <h1 style="margin-top:0;color:#1e293b;">Contact Form Submission</h1>
  <p><strong>Name:</strong> ${name}</p>
  <p><strong>Email:</strong> ${email}</p>
  <p><strong>Subject:</strong> ${subject}</p>
  <p><strong>Message:</strong></p>
  <p>${message}</p>
</div>
`.trim()

    await sendEmail(`Contact Form: ${subject}`, htmlBody)

    return response(200, { message: 'Message sent' })
  } catch (error) {
    return handleError(error)
  }
}
