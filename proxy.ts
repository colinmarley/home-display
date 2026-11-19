/**
 * Next.js root proxy (formerly middleware)
 * Reads X-Correlation-ID from incoming requests (or generates a new UUID)
 * and echoes it in the response header so clients can trace their requests.
 */
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const CORRELATION_HEADER = 'X-Correlation-ID'

export function proxy(request: NextRequest) {
  const correlationId =
    request.headers.get(CORRELATION_HEADER) ??
    crypto.randomUUID()

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set(CORRELATION_HEADER, correlationId)

  const response = NextResponse.next({ request: { headers: requestHeaders } })
  response.headers.set(CORRELATION_HEADER, correlationId)
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
