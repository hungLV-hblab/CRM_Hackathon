import { execSync } from 'node:child_process'

/**
 * Reseeds the demo database before the end-to-end suite runs.
 *
 * Not a convenience. The read zone ACCUMULATES: every click on "Đọc lại nguồn" adds a snapshot
 * row, so a suite run against whatever the previous run left behind sees a different screen
 * each time — two snapshot cards where it expects one, or "đã đọc, không đổi" on a first read.
 * Both showed up as failing assertions on correct behaviour, which is the worst kind of flake:
 * it invites someone to weaken the assertion instead of fixing the state.
 *
 * This is the same guarantee I-14 gives the judges ("nạp seed lại đưa mọi công ty về bản chụp
 * trước"), used for the same reason: a scenario you cannot replay from a known state is a
 * scenario you cannot check.
 *
 * It runs against the compose stack's database, so `pnpm start` must already be up — the same
 * precondition the suite itself has.
 */
export default function globalSetup(): void {
  execSync('pnpm seed', { stdio: 'inherit' })
}
