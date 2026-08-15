# Phase 01 — Preamble dùng chung + khai báo công cụ bơm vào prompt

## Bối cảnh

Hai mẫu lấy từ `trycompai/crm@f2484fb`:

1. **`agent/instructions.md`** — 7 dòng nền, đứng dưới mọi phiên: *"Never invent a CRM record, connected integration, completed action, or external side effect. Tools and persisted state are the authority."* Ta có luật này ở CLAUDE.md nhưng **không skill nào phát biểu nó ở dạng tổng quát** cho model.
2. **`agent/lib/capabilities.ts` + `markdownFor()`** — họ bơm danh sách năng lực vào prompt, kèm câu *"Not configured here, so do not plan around them"*. Ta chặn bằng `--allowed-tools` (mạnh hơn: model **không gọi được**) nhưng **không nói cho model biết**. Hệ quả thật: `extract-claims` có 0 tool mà không biết, nên có thể "định" tra cứu rồi bịa kết quả; `discover-sources` không biết nó chỉ có đúng `WebSearch`.

Thêm một câu lấy nguyên từ `agent/skills/evidence.md`, đúng cho cả hai skill: *"Do not go looking for extra evidence to push a claim over a line."*

## Yêu cầu

- Preamble là **file dữ liệu** (`skills/_base.md`), không phải hằng số trong `.ts` — cùng lý do `skill-registry.ts` đã nêu cho `SKILL.md`: sửa luật là sửa văn bản, review được bởi người không đọc TypeScript.
- Khai báo công cụ **sinh từ `policy.json`**, không gõ tay vào markdown. Gõ tay là tạo bản sao thứ hai của `allowedTools`, và bản drift là bản không ai nhìn.
- Thiếu `_base.md` là **lỗi boot**, cùng hạng với `policy.json` thiếu `maxTurns`: nó là một phần vỏ an toàn, mất im lặng thì mọi skill yếu đi mà không ai thấy.
- `/health` **chỉ thêm** field, không sửa field cũ — `apps/api/src/ai/agent-runtime-client.ts:93` khai `skills: string[]`.

## File

| File | Việc |
| --- | --- |
| `apps/agent-runtime/skills/_base.md` | Tạo |
| `apps/agent-runtime/src/skill-registry.ts` | Sửa — đọc base, ghép base + khai báo công cụ + thân skill |
| `apps/agent-runtime/src/main.ts` | Sửa — `/health` thêm `grants` |
| `apps/agent-runtime/src/__tests__/skill-registry-validates-policy.test.ts` | Sửa — helper viết cả `_base.md`; thêm test cho ghép và cho lỗi boot |

## Thứ tự ghép, và vì sao

`_base.md` (khung) → khai báo công cụ (hoàn cảnh) → thân `SKILL.md` (nhiệm vụ).

Thân skill đứng **cuối** vì nó là thứ cần nổi nhất; khung đứng đầu vì nó phải đúng kể cả khi model đọc lướt phần sau.

## Kiểm chứng

- `pnpm --filter @crm/agent-runtime test`
- `pnpm typecheck`
- Chạy thật một lượt mỗi skill qua `:8080`

## Rollback

Revert một commit. `_base.md` và phần compose đi cùng nhau; không đụng contracts/DB/web.
