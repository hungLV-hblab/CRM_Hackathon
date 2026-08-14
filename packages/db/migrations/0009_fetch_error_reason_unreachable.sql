-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- A tenth failure reason: the host could not be reached at all.
-- ═══════════════════════════════════════════════════════════════════════════════════════════
--
-- 0008 wrote a closed list of nine reasons, drawn up before any code had opened a socket. The
-- first real read found the gap: DNS that does not resolve, a refused connection, a TLS
-- handshake that fails — none of the nine describes any of them.
--
-- The temptation is to reuse `timeout`, and that is precisely what rule 4 of CLAUDE.md forbids.
-- The label a Sales person reads for `timeout` is "Trang không phản hồi kịp", and a connection
-- refused in three milliseconds did not fail to answer in time; it was never answered at all.
-- `invalid_url` is wrong for the opposite reason — a company's real website that is down today
-- is not an invalid address, and telling someone to fix the address sends them after a bug that
-- does not exist. A wrong line is worse than a missing one, so the list grows by one.
--
-- Additive only. Existing rows cannot violate the wider list, and the constraint is replaced
-- rather than the column altered, so nothing is rewritten.
ALTER TABLE observations
  DROP CONSTRAINT observations_fetch_error_reason_check;
--> statement-breakpoint

ALTER TABLE observations
  ADD CONSTRAINT observations_fetch_error_reason_check
  CHECK (
    fetch_error_reason IS NULL
    OR (
      fetch_status = 'failed'
      AND fetch_error_reason IN (
        'timeout', 'http_4xx', 'http_5xx', 'redirect_loop', 'js_required',
        'not_html', 'too_large', 'blocked_url', 'invalid_url', 'unreachable'
      )
    )
  );
