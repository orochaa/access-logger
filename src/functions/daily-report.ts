import type { APIGatewayProxyHandler } from 'aws-lambda'
import { getAccessLogs } from '../shared/dynamodb-client.js'
import { handleError } from '../shared/error-handler.js'
import { getRandomGifUrl } from '../shared/gif.js'
import {
  formatHtmlShell,
  formatReport,
  generateNoAccessReportContent,
  generateReport,
} from '../shared/report-generator.js'
import { sendEmail } from '../shared/ses-client.js'

export const handler: APIGatewayProxyHandler = async () => {
  try {
    const now = new Date()
    const start = new Date(now.getTime() - 86_400_000)
    const accessLogs = await getAccessLogs(start, now)
    const randomGifUrl = await getRandomGifUrl()

    let reportContent: string

    if (accessLogs.length === 0) {
      reportContent = generateNoAccessReportContent('day', start, now)
    } else {
      const report = generateReport(accessLogs)
      reportContent = formatReport(report, start, now)
    }

    const formattedReport = formatHtmlShell(
      'Daily Access Report',
      reportContent,
      randomGifUrl
    )
    await sendEmail('Daily Access Report', formattedReport)

    return { statusCode: 200, body: JSON.stringify({ message: 'Report sent' }) }
  } catch (error) {
    return handleError(error)
  }
}
