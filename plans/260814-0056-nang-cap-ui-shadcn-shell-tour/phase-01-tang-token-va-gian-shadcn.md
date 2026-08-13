---
phase: 1
title: "Tầng token + giàn shadcn"
status: pending
priority: P1
effort: "30'"
dependencies: []
---

# Phase 1: Tầng token + giàn shadcn

## Overview

Mở thang bo góc, dựng lớp alias để component shadcn ăn được token có sẵn, cài deps. **Không thêm một component nào ở phase này** — chỉ dựng giàn để P2 và P3 leo lên. Kết thúc phase, giao diện phải trông **y như cũ** trừ bo góc thẻ mềm hơn.

## Requirements

- Functional: `radius-card` mềm hơn · có token pill · component shadcn thêm sau này tự động ăn màu `ink-*`/`brand-*`/`machine-*` mà không cần sửa từng file · `cn()` dùng được.
- Non-functional: `pnpm build` xanh (Tailwind v4 lỗi token là lỗi **lúc build**, không phải lúc chạy) · không có block `.dark` trong repo · baseline test ghi lại được để P3 đối chiếu.

## Bước 0 — chốt baseline TRƯỚC khi sửa gì

Đây là phase duy nhất chạy được baseline sạch. Không có nó thì P3 không biết mình làm đỏ cái gì.

```bash
pnpm start                 # terminal khác, chờ caddy "serving initial configuration"
pnpm seed
pnpm test 2>&1 | tee plans/260814-0056-nang-cap-ui-shadcn-shell-tour/baseline-test-output.txt
```

Ghi vào `## Baseline` cuối file này: số spec pass, số unit test pass, thời gian chạy. **Con số này là hợp đồng của cả plan.**

## Architecture

### Thang bo góc — 3 giá trị

```css
--radius-control: 0.5rem;   /* giữ nguyên: nút, ô nhập */
--radius-card:    1rem;     /* từ 0.75rem — mềm hơn, vẫn cạnh thẳng */
--radius-pill:    9999px;   /* mới: nav item, filter chip, nút icon, avatar */
```

**Không có giá trị thứ tư.** Bảng và ô nhập giữ cạnh thẳng: trên màn CRM dày dữ liệu, cạnh thẳng chính là thứ mắt dùng để căn cột.

### Lớp alias shadcn — `@theme inline`

Đặt **sau** khối `@theme` hiện có, trỏ hết về token đã có. Không sinh màu mới:

| Biến shadcn | Trỏ về | Vì sao |
| --- | --- | --- |
| `--color-background` | `ink-50` | `body` đang dùng `bg-ink-50` |
| `--color-foreground` | `ink-900` | chữ chính 18.39:1 |
| `--color-card` / `--color-popover` | `#fff` | thẻ nổi trên `ink-50` |
| `--color-primary` | `brand-400` | "cam = người sắp bấm" |
| `--color-primary-foreground` | `ink-900` | ink trên cam = 11.36:1. **Không phải trắng** — trắng trên `brand-400` là 1.7:1 |
| `--color-secondary` / `--color-accent` / `--color-muted` | `ink-100` | nền nhấn nhẹ |
| `--color-muted-foreground` | `ink-600` | chữ phụ 6.74:1 |
| `--color-destructive` | `danger` | |
| `--color-border` | `ink-200` | viền thẻ hiện tại |
| `--color-input` | `ink-300` | viền ô nhập hiện tại |
| `--color-ring` | `ink-900` | focus ring toàn cục đã là ink |

**Luật phải ghi vào [design-guidelines](../../docs/design-guidelines.md):**

> Tên semantic của shadcn (`bg-background`, `text-primary`, …) là **lớp dịch cho component vendored trong `components/ui/`**, không phải từ vựng của app. Code màn hình vẫn viết `ink-*` / `brand-*` / `machine-*`.

Không có luật này thì repo có hai bộ từ vựng màu, và điều cấm "không dùng `slate-*`" mất hiệu lực — vì ai cũng viết `bg-background` được mà không ai biết nó là màu gì.

### Deps

```
radix-ui  class-variance-authority  clsx  tailwind-merge  lucide-react  sonner  driver.js
```

**Bỏ `tw-animate-css`.** Animation của nó dài hơn trần 300ms của dự án. Cần keyframe thì tự viết 2 cái trong `globals.css` dùng `--duration-motion`.

**Chốt Lucide** — design-guidelines đang để ngỏ ở "Câu hỏi chưa giải quyết" (*"Chưa có bộ icon thống nhất trong repo. Màn hình đầu tiên cần icon là chỗ phải chốt Lucide và cài một lần"*). P2 là màn hình đầu tiên cần icon. Chốt ở đây, sửa câu hỏi mở đó thành quyết định.

### `components.json` viết tay

Không chạy `shadcn init`. Viết tay để `shadcn add` biết đường, và **không** cho nó quyền chạm theme:

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": true,
  "tsx": true,
  "tailwind": { "config": "", "css": "src/app/globals.css", "baseColor": "neutral", "cssVariables": true },
  "aliases": { "components": "@/components", "ui": "@/components/ui", "lib": "@/lib", "utils": "@/lib/utils", "hooks": "@/hooks" },
  "iconLibrary": "lucide"
}
```

`"config": ""` là đúng cho Tailwind v4 — không còn `tailwind.config.js`.

## Related Code Files

- Modify: `apps/web/src/app/globals.css` — thang bo góc + `@theme inline`
- Modify: `apps/web/package.json` — 7 deps
- Create: `apps/web/components.json`
- Create: `apps/web/src/lib/utils.ts` — `cn()`
- Modify: `docs/design-guidelines.md` — mục 4 (thang bo góc 3 giá trị) · luật alias · chốt Lucide ở "Câu hỏi chưa giải quyết"

## Implementation Steps

1. **Chốt baseline** (bước 0 trên). Không làm bước này thì dừng.
2. `git commit` sạch trước khi cài gì — đường lùi của cả plan.
3. Cài 7 deps vào `apps/web` bằng `pnpm --filter @crm/web add ...`.
4. Viết `components.json` + `lib/utils.ts` (`cn()` = `twMerge(clsx(inputs))`).
5. Sửa `globals.css`: `--radius-card: 1rem`, thêm `--radius-pill`, thêm khối `@theme inline`. **Giữ nguyên toàn bộ comment giải thích đang có** — chúng là bằng chứng "giải thích được" của luật 7.
6. `shadcn add card skeleton` — hai component vô hại nhất, dùng làm phép thử lớp alias có hoạt động.
7. **Kiểm ngay:** `grep -n "dark\|oklch\|--background:" apps/web/src/app/globals.css` — nếu `shadcn add` lỡ ghi gì vào theme thì thấy ở đây. Xoá.
8. `pnpm build` + `pnpm typecheck`.
9. Cập nhật `docs/design-guidelines.md`.

## Tests First

Phase này chưa có component để test hành vi, nên "tests-first" ở đây là **kiểm chứng cơ học**, viết trước khi sửa `globals.css`:

1. Script kiểm token, chạy được lặp lại (đặt cạnh unit test của web, hoặc một dòng trong P6 checklist):
   - `apps/web/src` **không** chứa `slate-`, `amber-`, `indigo-`, `bg-[#`
   - `globals.css` **không** chứa `.dark` hay `[data-theme`
   - `globals.css` chứa đúng 3 token `--radius-*`
2. `pnpm build` là test thật của Tailwind v4: token thiếu → build đỏ, không phải chạy mới biết.

## Success Criteria

- [ ] `baseline-test-output.txt` có số spec/unit pass ghi rõ trong mục `## Baseline` file này
- [ ] `globals.css` có đúng 3 token `--radius-*`, không có `.dark`, không có oklch lạ
- [ ] `@theme inline` map đủ 12 biến ở bảng trên
- [ ] `--color-primary-foreground` là `ink-900`, **không phải** trắng
- [ ] Toàn bộ comment giải thích cũ trong `globals.css` còn nguyên
- [ ] `Card` + `Skeleton` render đúng màu token (ảnh chụp một màn bất kỳ, so bằng mắt)
- [ ] `pnpm build` + `pnpm typecheck` xanh
- [ ] `pnpm test` vẫn khớp baseline
- [ ] design-guidelines đã có luật alias + đã chốt Lucide

## Risk Assessment

| Rủi ro | Đối sách |
| --- | --- |
| `shadcn add` ghi đè theme dù không dùng `init` | Bước 7 grep ngay sau lần `add` đầu tiên. Có commit sạch ở bước 2 để `git checkout globals.css` |
| Đổi `--radius-card` làm vỡ layout chỗ nào không ngờ | Chỉ là bo góc, không đổi kích thước. Nếu vỡ thì trả về 0.75rem — mất "mềm hơn", không mất gì khác |
| Lớp alias làm người sau viết `bg-background` khắp nơi | Luật ở design-guidelines + kiểm trong P6. Không có cách enforce bằng máy trong phạm vi hackathon — nói thẳng đây là luật dựa vào người |
| `tw-animate-css` bị `shadcn add` kéo vào theo | Kiểm `package.json` sau mỗi `add`. Có thì bỏ, và bỏ dòng `@import` nó chèn |

## Baseline

**Chốt 14/08 02:25. `pnpm test` → EXIT 0.** Con số này là hợp đồng của cả plan.

| Đo | Giá trị |
| --- | --- |
| Unit (`vitest run`) | **225 test / 21 file, tất cả pass** — 48.32s |
| e2e (`playwright test`) | **11 test pass** — 14.9s |
| File output | [`baseline-test-output.txt`](./baseline-test-output.txt) |

**Điều kiện baseline này đo được — lệch điều kiện thì con số hết giá trị so sánh:**

- **Chạy trên nhánh fixture, không phải LLM thật.** `ANTHROPIC_API_KEY` trống trong `.env`, nên provider rơi về fixture adapter — đường lùi có chủ đích, ghi ở [`infra/docker-compose.yml`](../../infra/docker-compose.yml) dòng 13–17. Nếu giữa chừng có người cắm key vào, `diff` ở P6 sẽ lệch vì lý do **không liên quan gì tới UI**. Cắm key thì phải chạy lại baseline.
- Stack production ở `:8080`, seed vừa chạy, mọi công ty ở bản chụp "trước".
- Playwright **1.62.1** + chromium build **1234**.

### Ba thứ phải sửa để baseline chạy được — không nằm trong plan, nhưng chặn cứng

1. **`JWT_SECRET` trống trong `.env`** → `docker compose` từ chối khởi động. Đã sinh một khoá cục bộ (`.env` nằm trong `.gitignore`, không vào commit).
2. **`infra/postgres-init/01-roles.sh` bị CRLF** → Linux đọc shebang thành `#!/bin/bash\r` và báo `cannot execute: required file not found`. Postgres chạy init script **đúng một lần trên volume rỗng**, nên hỏng này **im lặng và vĩnh viễn**: cluster lên mà không có role `crm_*`, và mọi kết nối sau đó chết với `role "crm_owner" does not exist` — thông báo trỏ đi chỗ khác hoàn toàn. Đã đổi về LF **và** thêm [`.gitattributes`](../../.gitattributes) (`*.sh text eol=lf`) để lần checkout Windows sau không tái lập. Phải `pnpm reset` xoá volume rồi dựng lại thì init mới chạy.
3. **`packages/contracts` chưa build** → `pnpm seed` chết với `MODULE_NOT_FOUND: @crm/contracts`. Chạy `pnpm --filter @crm/contracts build && pnpm --filter @crm/db build` trước khi seed.

Điểm 2 là lỗi thật của repo trên mọi máy Windows, không phải sự cố riêng của máy này.
