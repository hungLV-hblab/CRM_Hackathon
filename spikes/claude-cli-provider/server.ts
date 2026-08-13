import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { extractClaims } from './extract-claims.ts'
import { resolveCliPath, sandboxPath } from './claude-cli.ts'

/**
 * The whole backend of the spike: one screen, one endpoint, no database. Deliberately not
 * wired into `apps/api` — the question being answered is "does driving the CLI from a server
 * process work at all", and answering it should not require Postgres to be up.
 */

const HERE = dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.PORT ?? 4599)
const MAX_BODY_BYTES = 200_000

const server = createServer((req, res) => {
  if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
    readFile(join(HERE, 'public', 'index.html'))
      .then((html) => {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
        res.end(html)
      })
      .catch(() => send(res, 500, { error: 'Không đọc được index.html' }))
    return
  }

  if (req.method === 'POST' && req.url === '/api/extract') {
    readBody(req)
      .then(async (body) => {
        const snapshot = typeof body.snapshot === 'string' ? body.snapshot : ''
        if (snapshot.trim().length === 0) {
          return send(res, 400, { error: 'Bản chụp đang trống' })
        }
        const result = await extractClaims(snapshot)
        send(res, 200, result)
      })
      .catch((error: Error) => send(res, 500, { error: error.message }))
    return
  }

  send(res, 404, { error: 'Không có đường dẫn này' })
})

function readBody(req: NodeJS.ReadableStream): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let raw = ''
    req.on('data', (chunk: Buffer) => {
      raw += chunk.toString('utf8')
      if (raw.length > MAX_BODY_BYTES) reject(new Error('Bản chụp quá dài'))
    })
    req.on('end', () => {
      try {
        resolve(JSON.parse(raw || '{}') as Record<string, unknown>)
      } catch {
        reject(new Error('Body không phải JSON'))
      }
    })
    req.on('error', reject)
  })
}

function send(res: import('node:http').ServerResponse, status: number, payload: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(payload))
}

// Fail at boot, not on the first click: a missing CLI is the one error a demo must not
// discover in front of an audience.
const cliPath = resolveCliPath()

server.listen(PORT, () => {
  console.log(`Claude CLI  : ${cliPath}`)
  console.log(`Thư mục chạy: ${sandboxPath()}`)
  console.log(`Màn hình    : http://localhost:${PORT}`)
})
