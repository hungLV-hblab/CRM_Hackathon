---
title: 'Xác nhận Claude Code chạy thật, và báo lỗi phân biệt được khi không chạy'
description: >-
  Badge trạng thái đang khẳng định thứ nó không biết: resolveAuthMode() chỉ kiểm
  sự tồn tại, nên credential hết hạn · token bị thu hồi · hết quota · thiếu
  binary đều hiện xanh như nhau. Chạy thật một lượt, ghi lastRun cho mọi lượt
  /run/*, và dịch từng lý do hỏng thành một câu kèm việc phải làm.
status: completed
priority: P1
effort: medium
branch: feat/agent-runtime-walking-skeleton
tags:
  - agent-runtime
  - auth
  - observability
  - ui
blockedBy: []
blocks: []
created: '2026-08-15T06:28:36.540Z'
createdBy: 'ck:plan'
source: skill
---

# Xác nhận Claude Code chạy thật, và báo lỗi phân biệt được khi không chạy

| | |
| --- | --- |
| **Chế độ** | `--tdd` — test trước ở từng pha |
| **Brainstorm** | [brainstorm-260815-1311](../reports/brainstorm-260815-1311-xac-nhan-claude-code-chay-that-report.md) |
| **Quyết định** | [ADR-0044](../../docs/decisions/0044-kiem-tra-claude-code-chay-that-di-qua-api-chu-khong-mo-them-cua-cong-khai.md) |
| **Nền** | [ADR-0038](../../docs/decisions/0038-agent-runtime-la-container-rieng-giu-credential-claude-khong-giu-csdl.md) · [ADR-0041](../../docs/decisions/0041-thieu-cau-hinh-la-mat-nang-luc-khong-phai-chet-va-vi-sao-khong-ghi-audit-tu-day.md) · [ADR-0043](../../docs/decisions/0043-dang-nhap-claude-qua-giao-dien-va-vi-sao-api-chi-ky-ve.md) |
| **Ràng buộc** | Vòng 1 chốt **15:00 hôm nay**. Đây là **hardening** tính năng vừa ship sáng nay, không phải feature mới sau freeze |

## Overview

Sau ADR-0043, admin đăng nhập Claude được từ giao diện. Nhưng thứ duy nhất hiện ra sau đó là một badge lấy từ `resolveAuthMode()` — và hàm đó chỉ kiểm **sự tồn tại**: biến môi trường có mặt, hoặc file `.credentials.json` có mặt.

Bốn tình huống hỏng hoàn toàn khác nhau đều hiện **một badge xanh giống hệt**:

| Tình huống | Panel hiện | Mọi lượt chạy thật |
| --- | --- | --- |
| Credential hết hạn | 🟢 `Phiên đăng nhập trong container` | `not_authenticated` |
| Token bị thu hồi | 🟢 `Token OAuth` | `not_authenticated` |
| Hết quota gói đăng ký | 🟢 xanh | `quota_exhausted` |
| Thiếu binary `claude` trong image | 🟢 xanh | `spawn_failed` |

Luật 4 của `CLAUDE.md`: **một dòng sai tệ hơn một dòng để trống.** Và cụ thể hơn — **hết credential và hết quota hôm nay trông y hệt nhau**, trong khi hai sự cố này đòi hai hành động ngược nhau: một cái bảo đăng nhập lại, cái kia bảo **tuyệt đối đừng bấm lại**.

Câu duy nhất trả lời được "Claude Code đang hoạt động" là **chạy thật một lượt và cho xem bằng chứng**.

## Ba câu quyết định toàn bộ thiết kế

1. **Nút "Kiểm tra ngay" không phải nguồn sự thật.** Nguồn sự thật là lượt chạy gần nhất, **bất kể ai gây ra nó** — một lượt `extract-claims` nghiệp vụ vừa xong chứng minh mạnh hơn một lượt ping giả. Cái nút chỉ là cách rẻ nhất để ép một lượt xảy ra khi chưa có lượt nào.
2. **Cửa tiêu quota không được ló ra ngoài.** Lượt kiểm tra đi `api → /run/health-check` bằng `Bearer AGENT_TOKEN`. Route ticket trên runtime đã bị loại vì nó đặt một endpoint tiêu tiền vào đúng họ route Caddy forward (ADR-0044 trục 2). **Caddyfile không đổi một dòng nào.**
3. **Kết quả sống trong bộ nhớ runtime, không vào CSDL.** Container mới thì thật sự chưa ai kiểm tra nó bao giờ — mất theo container là **đúng**, không phải hạn chế.

## Luồng

```
Trình duyệt (admin, đã đăng nhập CRM)
 1. POST /api/settings/agent-check          → api: kiểm JWT + @Roles('admin')
                                               thiếu AGENT_TOKEN → 503 (tắt, không phải hỏng)
 2. api → POST agent-runtime/run/health-check
          Authorization: Bearer AGENT_TOKEN   ← cửa này Caddy KHÔNG forward, và không được forward
          body { userPrompt: 'ping' }
 3. runtime chạy `claude -p`, policy allowedTools: [] , maxTurns 1
 4. runtime ghi lastRun vào bộ nhớ — MỌI lượt /run/*, thành công lẫn thất bại
 5. api trả xuống; reason của lỗi đi xuống NGUYÊN VẸN, không hoá thành 500
 6. panel vẽ bằng chứng: văn bản model trả lời + elapsed/api ms + token + session + authMode thật
```

Panel **tự bắn** bước 1 ngay sau khi đăng nhập thành công, và có nút bấm tay cho các lần sau. **Không** tự chạy khi mở trang — nếu không, mỗi lần một admin mở `/quan-tri` là tiêu quota thật.

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Runtime — skill health-check và lastRun mọi lượt](./phase-01-runtime-skill-health-check-va-last-run.md) | Completed |
| 2 | [API — endpoint agent-check và DTO](./phase-02-api-endpoint-agent-check-va-dto.md) | Completed |
| 3 | [Web — panel bằng chứng và bảng dịch lỗi](./phase-03-web-panel-bang-chung-va-bang-dich-loi.md) | Completed |

Phụ thuộc tuyến tính: 1 → 2 → 3. Thứ tự này để phần đáng giá nhất (runtime nói được sự thật) xong trước nếu hết giờ — pha 1 xong là `/health` đã trả lời được câu hỏi, dù panel chưa vẽ.

## Ràng buộc xuyên suốt mọi pha

- **Không đụng Caddyfile.** Nếu một pha nào thấy cần sửa nó, pha đó đã đi sai đường — quay lại đọc ADR-0044 trục 2.
- **`/run/*` vẫn 401 khi thiếu `Bearer`.** Test hồi quy hiện có phải còn xanh, không được nới.
- **Không ghi CSDL, không ghi audit từ runtime** (ADR-0041). `lastRun` là chẩn đoán trong bộ nhớ.
- **Không sửa `resolveAuthMode()`.** Nó đúng ở tầng của nó; vấn đề nằm ở chỗ giao diện coi nó là bằng chứng "chạy được".
- **Thất bại sinh ra `reason`, không sinh ra phỏng đoán.** Không retry, không giá trị mặc định, không 500 (luật 4 của `apps/agent-runtime/CLAUDE.md`).
- **Ba trạng thái hiển thị, không phải hai:** chưa kiểm tra lần nào · đạt · hỏng kèm lý do. "Chưa kiểm tra" **không** được vẽ màu đỏ.

## Acceptance criteria

- [x] Một lượt chạy **thật** ép được từ giao diện và trả về bằng chứng — gọi thật `POST /api/settings/agent-check`: `200`, `text "OK"`, `6154ms` tổng / `1511ms` gọi model, `16.084` token vào / `4` ra, `session 4d830278…`
- [x] `lastRun.authMode` báo **credential thật sự chạy** (`oauth`), không phải cái đang cấu hình
- [x] Reload trang / mở tab thứ hai → vẫn thấy lượt gần nhất (`agent-status` chuyển tiếp `lastRun`, xác nhận trên stack)
- [x] `POST /run/*` **vẫn** 401 khi thiếu `Bearer`; từ ngoài `:8080` vào `/run/health-check` → **307** về trang đăng nhập
- [x] Sales gọi `POST /api/settings/agent-check` → **403** (curl thật trên `:8080`)
- [x] `pnpm test:unit` **622 xanh** (600 → 622) + `typecheck` 5/5 gói + `lint` sạch + **3/3 e2e panel** trên stack thật
- [x] Không sửa Caddyfile dòng nào. *`git diff infra/Caddyfile` không rỗng, nhưng 14 dòng đó là khối `/agent-auth/*` của ADR-0043 đã có sẵn trước phiên này; `/run/*` vẫn vắng mặt.*
- [ ] Credential hỏng → "bị từ chối"; hết quota → "đừng bấm lại"; thiếu binary → lỗi image; container chết → "không liên lạc được" — **khoá bằng unit test ở cả hai phía, chưa gây ra được trên stack thật** (phải cố tình phá credential hoặc đốt hết hạn mức)
- [ ] Đăng nhập xong → panel **tự** chạy một lượt — code đã nối (`submit.onSuccess` → `check.mutate()`), nhưng chỉ verify được khi có người bấm đồng ý bằng tài khoản Anthropic thật, đúng giới hạn ADR-0043 đã ghi

## Dependencies

Không plan nào chặn. Nối tiếp trực tiếp [260815-1058](../260815-1058-dang-nhap-claude-qua-ui-trong-docker/plan.md) (`completed`) — plan này sửa đúng chỗ plan đó để hở: đăng nhập xong rồi thì làm sao biết nó chạy được. Chồng lấn file với plan đó ở `settings.controller.ts` và `claude-login-panel.tsx`, nhưng plan đó đã đóng nên không tranh.

## Ngoài phạm vi

Sales không thấy khối này (Sales đã có banner `aiEnabled`) · không lịch sử nhiều lượt · không đo định kỳ · không tự chạy khi mở trang · không ghi CSDL · không đụng `/agent-auth/*` · không đụng Caddyfile.
