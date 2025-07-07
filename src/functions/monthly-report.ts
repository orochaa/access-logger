import type { APIGatewayProxyHandler } from 'aws-lambda'
import { getAccessLogs } from '../shared/dynamodb-client.js'
import { handleError } from '../shared/error-handler.js'
import { getRandomGifUrl } from '../shared/gif.js'
import {
  formatHtmlShell,
  formatReport,
  generateNoAccessReportContent,
  generateReport,
  sendReportEmail,
} from '../shared/report-generator.js'

export const handler: APIGatewayProxyHandler = async () => {
  try {
    const now = new Date()

    const firstDayOfLastMonth = new Date(
      now.getFullYear(),
      now.getMonth() - 1,
      1,
      0 + 3
    )

    const lastDayOfLastMonth = new Date(
      now.getFullYear(),
      now.getMonth(),
      0,
      23 + 3,
      59,
      59
    )

    const accessLogs = await getAccessLogs(
      firstDayOfLastMonth,
      lastDayOfLastMonth
    )
    const randomGifUrl = await getRandomGifUrl()

    let reportContent: string

    if (accessLogs.length === 0) {
      reportContent = generateNoAccessReportContent(
        'month',
        firstDayOfLastMonth,
        lastDayOfLastMonth
      )
    } else {
      const report = generateReport(accessLogs)
      reportContent = formatReport(
        report,
        firstDayOfLastMonth,
        lastDayOfLastMonth
      )
    }

    const formattedReport = formatHtmlShell(
      'Monthly Access Report',
      reportContent,
      randomGifUrl
    )
    await sendReportEmail('Monthly Access Report', formattedReport)

    return { statusCode: 200, body: JSON.stringify({ message: 'Report sent' }) }
  } catch (error) {
    return handleError(error)
  }
}
