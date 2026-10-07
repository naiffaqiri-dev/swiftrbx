import { NextResponse } from 'next/server'
import { parseWorkflowName } from 'workflow/observability'
import { getWorld } from 'workflow/runtime'
import { start } from 'workflow/api'
import { ticketReviewRemindersWorkflow } from '@/workflows/ticket-review-reminders'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const world = await getWorld()
    let cursor: string | null = null
    do {
      const page: Awaited<ReturnType<typeof world.runs.list>> = await world.runs.list({
        pagination: cursor ? { cursor } : {},
        resolveData: 'none',
      })
      const alreadyRunning = page.data.some((run) => (
        run.status === 'running'
        && parseWorkflowName(run.workflowName)?.functionName === 'ticketReviewRemindersWorkflow'
      ))
      if (alreadyRunning) {
        return NextResponse.json({ ok: true, started: false }, { headers: { 'Cache-Control': 'no-store' } })
      }
      cursor = page.cursor
    } while (cursor)

    const run = await start(ticketReviewRemindersWorkflow)
    return NextResponse.json({ ok: true, started: true, runId: run.runId }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ error: 'Unable to start ticket review workflow' }, { status: 500 })
  }
}
