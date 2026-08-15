---
phase: 3
title: Web — panel bằng chứng và bảng dịch lỗi
status: completed
priority: P1
dependencies:
  - 2
effort: ~45 phút
---

# Phase 3: Web — panel bằng chứng và bảng dịch lỗi

## Overview

Chỗ toàn bộ giá trị của plan hiện ra: thay một dấu chấm xanh bằng **bằng chứng kiểm chứng được**, và thay một thông báo lỗi chung bằng **câu nói rõ phải làm gì**.

## Hiển thị bằng chứng, không hiển thị dấu chấm xanh

Cả sản phẩm này chạy trên nguyên tắc "không provenance thì không hiển thị". Trạng thái Claude Code cũng không được miễn: đừng khẳng định "đang hoạt động", hãy **cho xem lượt chạy**.

```
┌─ Đã chạy thật · 13:07                       [Kiểm tra ngay] ─┐
│  Chạy bằng: Phiên đăng nhập trong container                  │
│  Model trả lời: "OK"                                         │
│  4.2s tổng — 1.1s gọi model, 3.1s khởi động                  │
│  16.204 token vào / 3 ra · session 4f2a…                     │
└──────────────────────────────────────────────────────────────┘
```

`elapsedMs` và `apiMs` để **tách**, không cộng làm một: hiệu số chính là chi phí khởi động tiến trình, và `http-routes.ts:226` đã giữ chúng riêng vì đúng lý do đó. Gộp lại là xoá con số duy nhất đáng theo dõi.

## Ba trạng thái, không phải hai

| Trạng thái | Khi nào | Vẽ thế nào |
| --- | --- | --- |
| **Chưa kiểm tra lần nào** | `lastRun` không có | Trung tính. **Không đỏ.** Chưa biết ≠ hỏng |
| **Đạt** | `lastRun.ok` | Khối bằng chứng ở trên |
| **Hỏng** | `!lastRun.ok` | Câu theo `reason` + việc phải làm |

## Bảng dịch lỗi — đây là phần "thông báo cho user"

| `reason` | Thông báo | Việc phải làm |
| --- | --- | --- |
| `not_authenticated` | Có credential nhưng **bị từ chối** — hết hạn hoặc đã thu hồi | Bấm Đăng nhập Claude lại |
| `quota_exhausted` | Hết lượt của gói đăng ký | Chờ reset, **đừng bấm lại ngay** |
| `spawn_failed` | Không chạy được `claude` trong container | Lỗi image, **không phải** lỗi đăng nhập |
| `timeout` | CLI không trả lời trong 30s | Thử lại; lặp lại là vấn đề mạng container |
| `parse_failed` | CLI trả về thứ không đọc được | Xem `docker compose logs agent-runtime` |
| *(reason lạ)* | Nhánh mặc định: hiện `message` thô | Không được vỡ giao diện |
| API 503 | `AGENT_TOKEN` chưa đặt — đang **tắt** | Đặt biến, khởi động lại stack |
| fetch hỏng | **Không liên lạc được** runtime | Kiểm tra container + `AGENT_RUNTIME_URL` |

Ba dòng đầu là lý do plan này tồn tại: hôm nay chúng là **cùng một badge xanh**.

## Tự chạy sau đăng nhập, không tự chạy khi mở trang

`submit.onSuccess` → `agentCheck.mutate()`. Chuỗi người dùng thấy: `Đang xác thực…` → `Đang kiểm tra Claude Code…` → kết quả.

**Không** gọi trong `useQuery`/`useEffect` lúc mount. Mỗi lần một admin mở `/quan-tri` mà tiêu một lượt quota thật là chi phí không ai đoán trước được, và nó biến một trang quản trị thành cái máy đốt tiền.

## Requirements

- Functional: `api.agentCheck()` trong `api-client.ts`; khối kết quả + nút "Kiểm tra ngay" trong `claude-login-panel.tsx`; tự bắn sau `submit` thành công.
- Non-functional: qua checklist mục 7 của [design-guidelines](../../docs/design-guidelines.md) — không class màu thô, vùng chạm **≥44px**, tương phản đủ. Khối bằng chứng dùng `machine-*` (máy sinh ra); nút dùng brand (người sắp bấm).

## Related Code Files

- Modify: `apps/web/src/lib/api-client.ts` (`agentCheck()`)
- Modify: `apps/web/src/app/(app)/quan-tri/claude-login-panel.tsx`
- Modify: `e2e/claude-login-panel.spec.ts`

## Implementation Steps — test trước

1. **Test trước — e2e** (`e2e/claude-login-panel.spec.ts`, nối vào spec đã có):
   - admin vào `/quan-tri` → thấy khối trạng thái; chưa lượt nào thì thấy **"Chưa kiểm tra lần nào"**, không phải màu đỏ
   - nút "Kiểm tra ngay" `boundingBox().height >= 44` — cùng luật `ui-invariants` áp ở mọi nơi khác
   - `data-testid` cho: `claude-check-run` (nút) · `claude-check-result` (khối) · `claude-check-error` (câu lỗi)

   **Không gọi Claude thật trong e2e.** Tốn quota và làm test giòn — spec hiện có đã tự đặt đúng ranh giới này cho bước uỷ quyền, giữ nguyên tinh thần đó. Hành vi thật đã khoá ở pha 1 và 2 bằng unit test.
2. `api-client.ts`: `agentCheck: () => call<...>('/settings/agent-check', { method: 'POST' })`, theo đúng lối `agentAuthTicket` đang dùng.
3. Panel: `useMutation` cho `agentCheck`; nguồn hiển thị ưu tiên `agentCheck.data` rồi mới tới `status.data?.lastRun` — cùng lý do `awaitingCode` đã phải lấy từ trạng thái **server** chứ không riêng mutation cục bộ (comment `claude-login-panel.tsx:133-141`): reload trang hoặc tab thứ hai phải thấy đúng thứ tab đầu thấy.
4. `submit.onSuccess` → `agentCheck.mutate()` sau khi `invalidateQueries`.
5. Bảng dịch lỗi thành một `Record<string, {title, action}>` + nhánh mặc định cho `reason` lạ.
6. `pnpm lint` + `pnpm typecheck` + `pnpm test:e2e` (cần stack chạy ở `:8080`).

## Success Criteria

- [ ] Đăng nhập xong → tự hiện kết quả lượt chạy, không cần bấm thêm
- [ ] Ba trạng thái vẽ đúng; "chưa kiểm tra" không đỏ
- [ ] `not_authenticated` và `quota_exhausted` ra **hai màn hình khác nhau**, mỗi cái nói rõ việc phải làm
- [ ] Reload trang → vẫn thấy lượt gần nhất (đi qua `status.data.lastRun`)
- [ ] Nút ≥44px, không class màu thô, qua checklist design-guidelines mục 7
- [ ] `pnpm test:unit` + `test:e2e` xanh

## Risk Assessment

| Rủi ro | Xử lý |
| --- | --- |
| Bẫy env-thắng-đĩa: đăng nhập xong nhưng lượt kiểm tra chạy bằng token `.env` | Hiện `lastRun.authMode` — **credential nào thật sự chạy**. Cảnh báo `oauth` đã có sẵn ở panel, giữ nguyên |
| Luồng đăng nhập dài thêm ~4–8s | Chấp nhận có chủ ý: đổi lấy việc biết ngay nó chạy được, thay vì biết lúc demo |
| Panel hiện `lastRun` của skill nghiệp vụ (`extract-claims`) làm admin bối rối | Hiện kèm **tên skill**. Nếu nhìn UI thật thấy rối thì lọc, nhưng mặc định là hiện tất — thông tin thật hơn |
| Kết quả cũ trông như kết quả vừa chạy | Luôn hiện **giờ** của `lastRun.at`, không hiện chữ "vừa xong" |
