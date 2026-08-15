# Scout — Cách test "AI tự nhập liệu + gửi thông báo"

Ngày 14/08/2026 · nhánh `feat/source-candidates-persistence` · scope: vùng tự chủ 3 & 4 + `notifications`

## 0. Trả lời ngắn

Tính năng này **đã có test, hai tầng, khá dày** — không phải xây từ đầu. Ba điểm nghiệm thu T-6/T-7/T-8 của Specs đều có cả integration (Vitest, DB thật, 3 role Postgres) lẫn e2e (Playwright, stack thật `:8080`).

Điều đáng làm nốt trong ngày hardening 15/08 **không phải thêm test cho happy path** — mà bịt 4 lỗ ở mục 5, trong đó lỗ số 1 làm bay một trong ba thứ "mua" quyền tự ghi của vùng 3.

## 1. Hai đường AI tự ghi, khác nhau về cơ chế → khác nhau về cách test

| | Vùng 3 · Việc tiếp theo | Vùng 4 · mục dòng thời gian |
| --- | --- | --- |
| Ghi ở | `apps/api/src/domain/opportunity/auto-next-step-service.ts:247-292` | `apps/api/src/watch/system-timeline-entry-service.ts:102-118` |
| Actor | pool `crm_system` (`poolFor` `:564`) | pool `crm_system` (`:56`) |
| Có thông báo? | **Có** — INSERT `notifications` cùng transaction `:288-291` | **Không** (cố ý — I-13: thao tác xoá là tín hiệu error-detection duy nhất) |
| An toàn nhờ | Hoàn tác 7 ngày + vết hai chiều + không đè ô người gõ (I-7) | Nhãn `created_by='system'` + câu trích + Sales xoá được (kèm lý do) + nhật ký vòng quét |
| Trigger được từ test? | **Có** — gọi service trực tiếp | **Không có route/CLI**; chỉ timer tự hẹn |

Cả hai INSERT đều viết **raw SQL liệt kê cột tay**, không dùng `db.insert()`. Không phải style: Drizzle builder nêu tên mọi cột kể cả cột `crm_system` không có `GRANT` → Postgres từ chối cả statement. Ai "dọn dẹp" chỗ này thành builder sẽ làm vỡ vùng 3 và 4 cùng lúc.

## 2. Thông báo là **row trong DB**, không phải toast

Source of truth: bảng `notifications` (`packages/db/src/schema/notifications.ts:18-33`). Toast sonner **không** dùng cho việc này — `sonner.tsx:17-20` ghi rõ lý do: toast không giữ được nút Hoàn tác.

Đường đi: `auto-next-step-service.ts:288` → `GET /notifications` (`notification.controller.ts:29`) → `api-client.ts:259` → `notification-strip.tsx:43`, render ở `/co-hoi` (`show="unread"`) và `/thong-bao` (`show="all"`).

`canUndo` tính bằng **server time** khi list (`notification-service.ts:37-69`), không tính ở client.

## 3. Cách chạy (PowerShell)

```powershell
# Integration — cần Postgres, KHÔNG cần app
pnpm dev
pnpm test:unit

# Một file / một tên test
pnpm vitest run apps/api/src/domain/opportunity/__tests__/t6-t7-auto-next-step-and-undo.test.ts
pnpm vitest run --project api -t "a notice does not disappear"

# e2e — cần stack thật
pnpm start                              # terminal 1, chiếm terminal
pnpm exec playwright install chromium   # một lần
pnpm exec playwright test e2e/t6-t7-auto-next-step-and-undo.spec.ts -g "T-7"
```

Lưu ý ảnh hưởng cách viết test:

- `vitest.config.mts:18` `fileParallelism: false` — mọi test integration dùng chung DB `crm_test` và đều TRUNCATE.
- `apps/web` **không** nằm trong vitest projects → repo hiện **không có hạ tầng test React** (không jsdom, không @testing-library).
- Playwright không có `webServer`; `globalSetup` chạy `pnpm seed` **một lần trước cả suite**, không giữa từng test.
- `.env` cần `DATABASE_URL_TEST{,_APP,_SYSTEM}`; e2e cần thêm `DATABASE_URL_OWNER`.

## 4. Bốn seam để viết test mới

**Seam 1 — gọi service trực tiếp** (nhanh nhất, dùng nhiều nhất). Dựng bằng `new`, không boot Nest:

```ts
// t6-t7-auto-next-step-and-undo.test.ts:59
new AutoNextStepService(systemConnection.db, appConnection.db, audit)
await autoNextSteps.react(SYSTEM_ACTOR, { companyId, savedClaims })
```

**Seam 2 — chạy đường thật qua ingest:** `buildIngest().ingest(NIMBUS, 'after', 'watch_cycle')` (`t6-t7:219`). Đây là đường đi qua `ClaimReactionService`, nơi duy nhất set được `proposeOnly` (trần I-15).

**Seam 3 — vòng quét, fake timer:** `worker.onModuleInit()` rồi `advance()` = `vi.advanceTimersByTimeAsync(ms)` **rồi** `await worker.awaitCurrentTick()`. `awaitCurrentTick` tồn tại vì fake clock chỉ bắn `setTimeout`, không biết query Postgres đang bay (`watch-cycle-service.ts:52-57`).

**Seam 4 — e2e, không trigger được thì ép nhịp rồi poll:**

```
setWatchCycleSeconds(10)      → worker nhặt lên KHÔNG cần restart (ADR-0011)
resetReadHistory(names,'before')
chờ baseline: 1 cycle thật companiesScanned>=3
setSnapshotVariant(CHANGED,'after')   ← hành động duy nhất, và nó không phải một cú bấm
waitFor(...) poll 2s / deadline 120s
afterAll: setWatchCycleSeconds(60)    ← BẮT BUỘC, quên là mọi run sau có worker đọc 5 nguồn/10s
```

**Không dùng fake clock cho cửa sổ 7 ngày.** Cách đang dùng: dịch deadline bằng SQL dưới role owner — `UPDATE auto_next_step_events SET undo_deadline = now() - interval '1 hour'` (`t6-t7:526`).

**Không `sleep` cố định trong e2e.** Ở nhịp 10s, một vòng vượt nhịp là **trạng thái bình thường** (I-10 ghi skip rồi đi tiếp) → sleep sẽ flaky hoặc dài vô lý. "Trong 2 chu kỳ" là bound trên **số vòng**, không phải số giây.

## 5. Lỗ đáng bịt — xếp theo mức nguy hiểm

**① `no_owner_to_notify` không có test nào.** `auto-next-step-service.ts:138-144`: công ty không có người phụ trách → **không tự ghi**, vì thông báo tức thì là một trong ba thứ mua quyền vùng 3. Chuỗi `no_owner_to_notify` chỉ xuất hiện đúng 2 lần trong toàn repo, cả hai trong chính service — **không assert nào**. Xoá nhánh này → AI ghi vào ô mà không ai được báo, và **mọi test vẫn xanh**. `companies.owner_id` nullable (`companies.ts:30`) nên test được ngay, ~15 dòng.

**② `markRead` không kiểm chủ sở hữu.** `notification-service.ts:76-89` nhận `actor` nhưng không dùng: SELECT theo `id` rồi UPDATE theo `id`, không có `user_id` trong WHERE. `list` **có** lọc `userId` (`:50`) → bất đối xứng, là sơ suất chứ không phải thiết kế. Hệ quả: bất kỳ ai có JWT hợp lệ đánh dấu đã xem thông báo của người khác → đúng thứ ontology dòng 59 hứa không xảy ra ("không tự biến mất trước khi `read_at` có giá trị" — nó không tự mất, nhưng người khác dismiss được). Nội bộ một đội Sales nên severity thấp, nhưng nó là **lời hứa trong ontology bị hở**, và fix + test đều ~5 dòng.

**③ `triggerContext` do client tự khai.** `packages/contracts/src/dto/observation.ts:63` cho phép body gửi `triggerContext: 'watch_cycle'`, controller truyền thẳng (`observation.controller.ts:30`). Sau ADR-0028 việc này **không** nâng quyền ghi (quyền phụ thuộc `is_watched`, không phụ thuộc `trigger_context`) — nên không phải lỗ bảo mật. Nhưng nó làm bẩn `claims.trigger_context`, cột mà provenance và nhật ký đọc. Không test nào chặn.

**④ `loadUndoable` refusal "đã có lần tự đặt mới hơn"** (`:480-482`) không test. Viết lại thành `created_at > $1` (chính bug microsecond đã sửa) vẫn xanh hết → regression im lặng.

Nhẹ hơn, ghi cho đủ: nhánh `recordError` bao cả `scan()` (`watch-cycle-service.ts:203-211`) chưa test (test 3 chỉ cover lỗi per-company); `SystemSettingService` không có file test riêng; hai route vùng 3 (`GET opportunities/auto-next-steps`, `POST auto-next-step-events/:id/undo`) chưa có test cấp HTTP; `NotificationStrip.groupByMessage` không test được vì không có hạ tầng test web.

**Một điều chỉnh so với suy đoán ban đầu:** fallback "rác trong `watch_cycle_seconds` → về 60" (`system-setting-service.ts:136-138`) **không** với tới được qua API — `updateSystemSettingsSchema` đã ghim min 5 / max 3600 (`system-settings.ts:30-42`). Chỉ tới được bằng SQL trực tiếp (chính e2e harness làm). Là lớp hai, không phải lỗ.

## 6. Test đã có — tra cứu nhanh

| Điểm | Integration | e2e |
| --- | --- | --- |
| T-6 tự đặt + thông báo | `t6-t7-auto-next-step-and-undo.test.ts` test 1-4 | `e2e/t6-t7-...spec.ts:70` |
| T-7 hoàn tác | cùng file, test 12-17 (gồm: hai lần máy ghi → về **rỗng**, không về câu máy ghi lần 1) | `:113` (nút vẫn enabled sau 6s — chống thay bằng toast) |
| I-6/I-7 cửa vào | test 5-11 | — |
| Quyền CSDL giữ 7 ngày | test 21: **GRANT lại `undo_deadline` → AI ghi được cửa sổ 1 phút**, rồi REVOKE | — |
| T-8 vòng quét | `watch-cycle-scans-and-writes.test.ts` (8), `system-timeline-entry-writes.test.ts` (bảng 2×2 ADR-0028) | `e2e/t8-...spec.ts` (5 test) |
| Nhịp + I-10 | `self-scheduling-watch-cycle.test.ts` (6) | — |
| I-13 xoá kèm lý do | `system-timeline-entry-removal.test.ts` (6) | `t8:146` |
| T-9 nút tắt | `self-scheduling...` test 3-4 | `e2e/t9-ai-kill-switch.spec.ts` (7 step) |
| Trần I-15 (nguồn thật) | `live-source-autonomy-ceiling.test.ts` — bảng 4 ô | — |
| Lớp CSDL | `column-grants-block-system-actor-on-ai-tables.test.ts` | — |

Vài chi tiết trong đó đáng học khi viết test mới, vì chúng chống đúng loại test-xanh-vô-nghĩa:

- T-8 assert công ty **không đổi nguồn có đúng 0 mục** (`t8:113`) — không có dòng này thì build ghi mục mỗi vòng cũng pass.
- T-9 assert **equality cả 4 con số** trước/sau khi tắt — "dừng sinh mới" ≠ "xoá cái đã sinh".
- e2e assert **chữ** "Do hệ thống thêm", không assert màu — bản in greyscale vẫn phải phân biệt được máy/người.
- `aiOutputCounts()` lấy 4 count **trong một query** — đọc rời tạo ra snapshot không thời điểm nào từng tồn tại.
- Grant-test assert giá trị bị từ chối là **UNCHANGED**, không chỉ "đã throw".

## Câu hỏi còn treo

1. Lỗ ② (`markRead` không check owner) — coi là bug cần fix trong hardening 15/08, hay ghi vào phần hạn chế đã biết? (Fix nhỏ, nhưng đổi hành vi route sau feature freeze.)
2. Lỗ ③ — có nên bỏ `triggerContext` khỏi contract public và để server ép `manual_ingest`? Cần biết ngoài UI còn consumer nào gửi `watch_cycle` không.
3. Có cần thêm vitest project cho `apps/web` (jsdom + @testing-library) chỉ để test `groupByMessage`, hay giữ nguyên chỉ e2e? Chi phí hạ tầng so với lợi ích trong 1 ngày còn lại.
4. Đã có ADR nào cân nhắc & loại bỏ route trigger vòng quét tay (`POST /admin/watch-cycle/run`) chưa? Nó quyết định T-8 có buộc phải poll 120s hay không.
