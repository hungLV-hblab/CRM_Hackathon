import type Anthropic from '@anthropic-ai/sdk'
import { describe, expect, it } from 'vitest'

import { AnthropicSourceDiscovery, type MessageCreate } from '../anthropic-source-discovery'

/**
 * The `web_search` adapter, against a scripted transport — never against Anthropic.
 *
 * Every case here is a shape the real API can return and a naive parser mishandles. Two of them
 * are the reason this file exists rather than a single happy-path assertion:
 *
 *   · `web_search_tool_result.content` is a LIST when the search worked and an ERROR OBJECT when
 *     it did not. Both arrive on a normal HTTP 200 with no exception raised, so a parser that
 *     indexes `.content[0]` reads a character out of an error code and reports it as a URL.
 *   · A server-tool loop that hits its internal limit stops with `stop_reason: "pause_turn"`.
 *     The turn is unfinished; treating it as an answer silently truncates the search.
 *
 * The transport is a function rather than a mocked module so the requests themselves can be
 * asserted — what the continuation sends matters as much as what the parser returns.
 */

const COMPANY = {
  companyName: 'Công ty Thử Nghiệm',
  companyWebsite: 'https://thu-nghiem.example.com',
  companyType: 'it_solution',
}

/** A minimal `Message`. Only the fields the adapter reads are real; the rest satisfies the type. */
function message(content: unknown[], stopReason = 'end_turn'): Anthropic.Message {
  return {
    id: 'msg_test',
    type: 'message',
    role: 'assistant',
    model: 'claude-sonnet-5',
    content,
    stop_reason: stopReason,
    stop_sequence: null,
    usage: { input_tokens: 1, output_tokens: 1 },
  } as unknown as Anthropic.Message
}

/** A successful search block: `content` is a LIST of results. */
function searchResults(...urls: string[]): unknown {
  return {
    type: 'web_search_tool_result',
    tool_use_id: 'srvtoolu_test',
    content: urls.map((url) => ({
      type: 'web_search_result',
      url,
      title: `Tiêu đề của ${url}`,
      encrypted_content: 'opaque',
      page_age: null,
    })),
  }
}

/** A failed search block: same block type, but `content` is a single ERROR OBJECT. */
function searchError(errorCode: string): unknown {
  return {
    type: 'web_search_tool_result',
    tool_use_id: 'srvtoolu_test',
    content: { type: 'web_search_tool_result_error', error_code: errorCode },
  }
}

function jsonBlock(payload: unknown): unknown {
  return { type: 'text', text: JSON.stringify(payload) }
}

function candidate(url: string, sourceTier = 'company_website'): unknown {
  return { url, sourceTier, snippet: 'đoạn trích', reason: 'trang chính thức của công ty' }
}

/** Records every request so the continuation protocol can be asserted, not assumed. */
function transport(...responses: Anthropic.Message[]): {
  create: MessageCreate
  requests: Anthropic.MessageCreateParams[]
} {
  const requests: Anthropic.MessageCreateParams[] = []
  let index = 0
  const create: MessageCreate = async (params) => {
    requests.push(params)
    const response = responses[Math.min(index, responses.length - 1)]
    index += 1
    return response
  }
  return { create, requests }
}

describe('a successful search becomes candidates', () => {
  it('1 · results plus a JSON answer → parsed candidates', async () => {
    const { create } = transport(
      message([
        searchResults('https://thu-nghiem.example.com/tin-tuc', 'https://baochi.example.com/bai'),
        jsonBlock({
          candidates: [
            candidate('https://thu-nghiem.example.com/tin-tuc'),
            candidate('https://baochi.example.com/bai', 'news'),
          ],
        }),
      ]),
    )

    const found = await new AnthropicSourceDiscovery(create).discover(COMPANY)

    expect(found).toHaveLength(2)
    expect(found[0].url).toBe('https://thu-nghiem.example.com/tin-tuc')
    expect(found[1].sourceTier).toBe('news')
    expect(found[1].snippet).not.toBe('')
  })

  it('2 · the request declares web_search and never declares code execution', async () => {
    const { create, requests } = transport(message([searchResults(), jsonBlock({ candidates: [] })]))

    await new AnthropicSourceDiscovery(create).discover(COMPANY)

    const tools = (requests[0].tools ?? []) as { type: string; max_uses?: number }[]
    const search = tools.find((tool) => tool.type.startsWith('web_search'))
    expect(search).toBeDefined()
    // Bounded on purpose: searches are billed per use, and an unbounded loop on a company with a
    // common name is the expensive failure.
    expect(search?.max_uses).toBeGreaterThan(0)
    /**
     * Dynamic filtering is built into this web_search version and runs code under the hood.
     * Declaring code execution as well gives the model a second execution environment and
     * confuses which one it should reach for.
     */
    expect(tools.some((tool) => tool.type.startsWith('code_execution'))).toBe(false)
  })
})

describe('an unfinished server-tool loop is resumed, not mistaken for an answer', () => {
  it('3 · pause_turn → the turn is continued and the final answer is returned', async () => {
    const paused = message([searchResults('https://baochi.example.com/bai')], 'pause_turn')
    const finished = message([
      searchResults('https://baochi.example.com/bai'),
      jsonBlock({ candidates: [candidate('https://baochi.example.com/bai', 'news')] }),
    ])
    const { create, requests } = transport(paused, finished)

    const found = await new AnthropicSourceDiscovery(create).discover(COMPANY)

    expect(found).toHaveLength(1)
    expect(requests).toHaveLength(2)

    /**
     * The continuation carries the paused assistant turn back and adds NOTHING else. Appending a
     * "Continue" user message is the intuitive move and it is wrong: the API resumes from the
     * trailing server-tool block on its own, and an extra user turn re-opens the conversation
     * instead of finishing the one in flight.
     */
    const followUp = requests[1].messages
    expect(followUp[followUp.length - 1].role).toBe('assistant')
    expect(followUp.filter((entry) => entry.role === 'user')).toHaveLength(1)
  })

  it('4 · a turn that never stops pausing is cut off instead of looping forever', async () => {
    const alwaysPaused = message([searchResults('https://baochi.example.com/bai')], 'pause_turn')
    const { create, requests } = transport(alwaysPaused)

    const found = await new AnthropicSourceDiscovery(create).discover(COMPANY)

    // Empty is the honest answer for a search that never finished — and the request count is
    // bounded, which is the assertion that matters: a live-locked loop bills forever.
    expect(found).toEqual([])
    expect(requests.length).toBeLessThanOrEqual(6)
  })
})

describe('a server-tool failure arrives as HTTP 200 and must not throw', () => {
  it.each(['max_uses_exceeded', 'too_many_requests', 'query_too_long', 'unavailable'])(
    '5 · error_code %s → no throw, no candidates',
    async (errorCode) => {
      /**
       * The shape trap. `content` here is an OBJECT, not a list — a parser that maps over it
       * reads characters out of `"max_uses_exceeded"` and reports them as search results.
       */
      const { create } = transport(
        message([searchError(errorCode), jsonBlock({ candidates: [] })]),
      )

      const found = await new AnthropicSourceDiscovery(create).discover(COMPANY)

      expect(found).toEqual([])
    },
  )

  it('6 · one failed search does not discard the results of a successful one', async () => {
    const { create } = transport(
      message([
        searchError('too_many_requests'),
        searchResults('https://baochi.example.com/bai'),
        jsonBlock({ candidates: [candidate('https://baochi.example.com/bai', 'news')] }),
      ]),
    )

    const found = await new AnthropicSourceDiscovery(create).discover(COMPANY)

    expect(found).toHaveLength(1)
  })
})

describe('a URL the search never returned is not a source', () => {
  it('7 · a candidate absent from every result block is dropped', async () => {
    /**
     * The guard that makes this adapter trustworthy. The prompt asks the model to return only
     * URLs it actually found, but rule 1 of CLAUDE.md does not accept an instruction as a
     * guarantee: an address nobody searched for is an address nobody can vouch for, and it would
     * become a page this product fetches. So the check is code — the URL must appear in a
     * `web_search_tool_result` from THIS call.
     */
    const { create } = transport(
      message([
        searchResults('https://baochi.example.com/bai'),
        jsonBlock({
          candidates: [
            candidate('https://baochi.example.com/bai', 'news'),
            candidate('https://bia-dat.example.com/khong-co-that'),
          ],
        }),
      ]),
    )

    const found = await new AnthropicSourceDiscovery(create).discover(COMPANY)

    expect(found).toHaveLength(1)
    expect(found[0].url).toBe('https://baochi.example.com/bai')
  })

  it('8 · a trailing slash is the same address, not a different one', async () => {
    const { create } = transport(
      message([
        searchResults('https://thu-nghiem.example.com/tin-tuc/'),
        jsonBlock({ candidates: [candidate('https://thu-nghiem.example.com/tin-tuc')] }),
      ]),
    )

    const found = await new AnthropicSourceDiscovery(create).discover(COMPANY)

    // Rejecting this would drop good candidates over punctuation; accepting any string would
    // drop the guarantee. Compare normalised URLs, not raw text.
    expect(found).toHaveLength(1)
  })
})

describe('a malformed answer costs the search, never the process', () => {
  it.each([
    ['prose instead of JSON', 'Tôi đã tìm thấy vài trang hữu ích cho công ty này.'],
    ['truncated JSON', '{"candidates": [{"url": "https://baochi.example.com/bai"'],
    ['the wrong shape', '{"results": ["https://baochi.example.com/bai"]}'],
    ['an unknown source tier', '{"candidates":[{"url":"https://baochi.example.com/bai","sourceTier":"tin đồn","snippet":"x","reason":"y"}]}'],
  ])('9 · %s → empty, not an exception', async (_label, text) => {
    const { create } = transport(message([searchResults('https://baochi.example.com/bai'), { type: 'text', text }]))

    // Same rule as `anthropic-claim-extractor.ts:143-148`: an unparseable answer is zero
    // findings, not a 500 that takes the caller down with it.
    await expect(new AnthropicSourceDiscovery(create).discover(COMPANY)).resolves.toEqual([])
  })
})

describe('the candidate list is bounded and free of duplicates', () => {
  it('10 · the same URL twice appears once', async () => {
    const { create } = transport(
      message([
        searchResults('https://baochi.example.com/bai'),
        jsonBlock({
          candidates: [
            candidate('https://baochi.example.com/bai', 'news'),
            candidate('https://baochi.example.com/bai/', 'news'),
          ],
        }),
      ]),
    )

    expect(await new AnthropicSourceDiscovery(create).discover(COMPANY)).toHaveLength(1)
  })

  it('11 · more than six candidates are cut to six', async () => {
    const urls = Array.from({ length: 9 }, (_, index) => `https://baochi.example.com/bai-${index}`)
    const { create } = transport(
      message([searchResults(...urls), jsonBlock({ candidates: urls.map((url) => candidate(url, 'news')) })]),
    )

    // A person has to read every one of these and tick the right ones. Nine rows is a chore;
    // six is a decision.
    expect(await new AnthropicSourceDiscovery(create).discover(COMPANY)).toHaveLength(6)
  })
})
