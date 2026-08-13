import { createServer, type ServerResponse } from 'node:http'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { extractClaims } from './extract-claims.ts'
import { resolveCliPath, sandboxPath } from './claude-cli.ts'
import { ClaudeChannel } from './claude-channel.ts'

/**
 * The whole backend of the spike: two screens, no database. Deliberately not wired into
 * `apps/api` — the question being answered is "can a server process drive the CLI at all",
 * and answering it should not require Postgres to be up.
 *
 *   /       one-shot   — a fresh `claude -p` per request  (claude-cli.ts)
 *   /chat   persistent — one live process across turns    (claude-channel.ts)
 */

const HERE = dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.PORT ?? 4599)
const MAX_BODY_BYTES = 200_000

const CHAT_SYSTEM_PROMPT = `Bạn là trợ lý của đội Sales ITO, trả lời bằng tiếng Việt, ngắn gọn.
Không biết thì nói thẳng là không biết — một câu trả lời sai tệ hơn một câu để trống.
Khi khẳng định điều gì lấy từ dữ liệu người dùng vừa đưa, trích lại nguyên văn đoạn đó.`

/** One conversation for one demo screen. A real deployment needs one channel per user. */
let channel = new ClaudeChannel(CHAT_SYSTEM_PROMPT, process.env.CLAUDE_CLI_MODEL?.trim() || undefined)

const server = createServer((req, res) => {
  const url = req.url ?? '/'

  if (req.method === 'GET' && (url === '/' || url === '/index.html')) return page(res, 'index.html')
  if (req.method === 'GET' && (url === '/chat' || url === '/chat.html')) return page(res, 'chat.html')

  if (req.method === 'GET' && url === '/api/chat/state') {
    return send(res, 200, { alive: channel.alive, turns: channel.turnCount })
  }

  if (req.method === 'POST' && url === '/api/chat/reset') {
    channel.close()
    channel = new ClaudeChannel(CHAT_SYSTEM_PROMPT, process.env.CLAUDE_CLI_MODEL?.trim() || undefined)
    return send(res, 200, { ok: true })
  }

  if (req.method === 'POST' && url === '/api/chat') {
    readBody(req)
      .then((body) => {
        const message = typeof body.message === 'string' ? body.message.trim() : ''
        if (message.length === 0) return send(res, 400, { error: 'Tin nhắn trống' })
        return streamTurn(res, message)
      })
      .catch((error: Error) => send(res, 500, { error: error.message }))
    return
  }

  if (req.method === 'POST' && url === '/api/extract') {
    readBody(req)
      .then(async (body) => {
        const snapshot = typeof body.snapshot === 'string' ? body.snapshot : ''
        if (snapshot.trim().length === 0) return send(res, 400, { error: 'Bản chụp đang trống' })
        send(res, 200, await extractClaims(snapshot))
      })
      .catch((error: Error) => send(res, 500, { error: error.message }))
    return
  }

  send(res, 404, { error: 'Không có đường dẫn này' })
})

/**
 * Deltas are forwarded to the browser as they arrive rather than buffered into one reply. The
 * point of a live channel is that the answer is visibly being written; buffering it here would
 * throw away the only part a person can see.
 */
async function streamTurn(res: ServerResponse, message: string): Promise<void> {
  res.writeHead(200, {
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-cache',
    connection: 'keep-alive',
  })

  const emit = (event: string, data: unknown): void => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
  }

  try {
    const result = await channel.send(message, (text) => emit('delta', { text }))
    emit('done', result)
  } catch (error) {
    emit('failed', { message: (error as Error).message })
  } finally {
    res.end()
  }
}

function page(res: ServerResponse, file: string): void {
  readFile(join(HERE, 'public', file))
    .then((html) => {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
      res.end(html)
    })
    .catch(() => send(res, 500, { error: `Không đọc được ${file}` }))
}

function readBody(req: NodeJS.ReadableStream): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let raw = ''
    req.on('data', (chunk: Buffer) => {
      raw += chunk.toString('utf8')
      if (raw.length > MAX_BODY_BYTES) reject(new Error('Nội dung quá dài'))
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

function send(res: ServerResponse, status: number, payload: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(payload))
}

// Fail at boot, not on the first click: a missing CLI is the one error a demo must not
// discover in front of an audience.
const cliPath = resolveCliPath()

server.listen(PORT, () => {
  console.log(`Claude CLI   : ${cliPath}`)
  console.log(`Thư mục chạy : ${sandboxPath()}`)
  console.log(`Rút phát hiện: http://localhost:${PORT}/`)
  console.log(`Đối thoại    : http://localhost:${PORT}/chat`)
})

process.on('SIGINT', () => {
  channel.close()
  process.exit(0)
})
