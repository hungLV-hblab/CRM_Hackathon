---
phase: 4
title: "Giao diện panel full-width"
status: done
effort: medium
priority: P1
dependencies: [3]
---

# Phase 4: Giao diện panel full-width

## Overview

Panel "Nguồn đọc" ra khỏi cột phải `24rem`, thành section full-width hai cột: nguồn đang đọc (có công tắc) bên trái, ứng viên đã lưu bên phải. Và sửa một câu chữ đã thành sai.

## Requirements

- `SectionCard "Nguồn đọc"` full-width, đặt **sau** grid 2 cột
- Ứng viên đọc từ `useQuery`, không `useState` ⇒ sống qua reload
- Bấm Lưu **không** làm ứng viên biến mất; ứng viên đã lưu hiện "Đã trong danh sách đọc" + bỏ tick được
- Nguồn đã lưu có công tắc Bật/Tắt; hàng đang tắt nói bằng **chữ**, không chỉ bằng màu
- Xoá được một ứng viên
- Vùng chạm ≥44px, chỉ dùng token `ink-*` / `brand-*` / `machine-*`

## Architecture

**Đọc [docs/design-guidelines.md](../../docs/design-guidelines.md) trước khi gõ dòng đầu tiên** — CLAUDE.md mục 6 nói không có ngoại lệ. Hai câu phải nhớ: **cam = người sắp bấm · tím = máy sinh ra**.

**Một câu chữ bắt buộc sửa, không phải thẩm mỹ.** `source-discovery-section.tsx:193` hiện là:

```tsx
<Badge tone="inference">Ứng viên do máy tìm — chưa lưu gì</Badge>
```

Ứng viên vào DB rồi thì `"chưa lưu gì"` là **một dòng sai** (luật 4) → `"Máy đã tìm được — chưa đưa vào danh sách đọc"`. Khối vẫn giữ hue `machine-*`: nó vẫn là thứ máy sinh ra, chỉ khác chỗ là nó đã được lưu.

Comment đầu file (dòng 14-25) nói *"a refresh loses the candidate list, because there is nowhere to keep it"* — viết lại, đừng để lại.

**State đổi hình:** `useState<SourceCandidateDto[] | null>` → `useQuery(['company-source-candidates', companyId])`. `picked` **bỏ hẳn**: một ứng viên chỉ có hai trạng thái và trạng thái đó đã ở server (`savedSourceId`). Tick = gọi save ngay cho một url; bỏ tick = gọi `removeCompanySource(savedSourceId)`. Nút "Lưu N nguồn đã chọn" biến mất cùng `picked`.

> **Đây là một quyết định phát sinh, ghi vào ADR-0037.** Brainstorm report giữ nút Lưu theo lô; nhưng khi ứng viên đã persist thì lô không còn lý do tồn tại — trạng thái tick không còn là state tạm cần gom lại. Nếu người quyết định muốn giữ nút Lưu theo lô thì `picked` ở lại và tick không gọi API ngay.

**Layout:** trong `SectionCard`, `grid gap-6 lg:grid-cols-2`. Không dùng `order-*` — cùng lý do đã ghi ở `page.tsx:87-96`: đảo thứ tự bằng CSS làm screen reader và người nhìn không đồng ý với nhau về cái gì đến trước.

## Related Code Files

- Modify: `apps/web/src/app/(app)/cong-ty/[id]/page.tsx` — kéo `SectionCard "Nguồn đọc"` (dòng 131-135) ra sau thẻ đóng grid (dòng 137)
- Modify: `apps/web/src/app/(app)/cong-ty/[id]/source-discovery-section.tsx` — gần như viết lại; **cân nhắc tách** thành `source-list-panel.tsx` + `source-candidate-panel.tsx` nếu quá 200 dòng
- Create: `e2e/source-candidates-survive-reload.spec.ts`

## Implementation Steps

### 1. Test trước — e2e

Không có e2e nào đang chạm panel nguồn (đã grep `e2e/`), nên đây là test mới hoàn toàn, không phải sửa:

```
1. Đăng nhập, mở một công ty NGOÀI seed (khuôn có sẵn ở e2e/login-and-create-company.spec.ts)
2. Bật nguồn thật → bấm "Tìm nguồn công khai" → thấy ứng viên
3. RELOAD → ứng viên vẫn còn                                    ← lý do phase này tồn tại
4. Tick một ứng viên → nó hiện "Đã trong danh sách đọc", và ứng viên KHÔNG biến mất
5. Bật/tắt nguồn đã lưu → thấy chữ "Đang tạm tắt"
6. Xoá một ứng viên → nó mất, các ứng viên khác còn
```

Cần `ANTHROPIC_API_KEY` hay không: **không** — `FixtureSourceDiscovery` suy ứng viên từ website đã lưu khi thiếu key (ADR-0036 Hệ quả), nên e2e chạy được offline. Xác nhận lại bằng cách đọc `fixture-source-discovery.ts` trước khi viết spec.

**Đỏ đúng lý do:** bước 3 đỏ trước khi sửa UI (ứng viên biến mất) — chứ không phải đỏ vì selector sai. Chạy một lượt để thấy đúng bước 3 đỏ.

### 2. Kéo panel ra full-width

Việc nhỏ nhất, làm trước, commit riêng: di chuyển `SectionCard` + sửa chữ badge. Sau bước này panel đã rộng dù logic chưa đổi. **Nếu freeze ép thì đây là mảnh ship được một mình.**

### 3. Viết lại section

- **Trái — "Nguồn đang dùng để đọc":** mỗi hàng badge tier · url · snippet · công tắc · nút Bỏ. Hàng `enabled === false`: `opacity` giảm **kèm** dòng `"Đang tạm tắt — không đọc trang này"`. Công tắc dùng `Button variant="secondary"`, nhãn đổi theo trạng thái, giống công tắc nguồn thật ở dòng 104-111.
- **Phải — "Ứng viên do máy tìm":** khối `machine-*`. Ứng viên có `savedSourceId`: `Badge tone="fact"` + `"Đã trong danh sách đọc"` + nút bỏ tick. Chưa có: checkbox tick. Mỗi hàng có nút xoá ứng viên.
- Giữ nguyên `EmptyState` khi chưa có nguồn, và câu *"Không tìm được trang nào chắc chắn…"* khi search trả rỗng — hai câu đó vẫn đúng.

### 4. Checklist giao diện

Chạy checklist mục 7 của design-guidelines: không class màu thô (`slate-*` / `amber-*`), vùng chạm ≥44px, tương phản đủ, trạng thái không chỉ mang bằng màu.

## Success Criteria

- [ ] e2e mới xanh cả 6 bước
- [ ] `pnpm test:e2e` toàn bộ xanh (cần stack ở `:8080`)
- [ ] Không còn `setCandidates` / `picked` nếu chọn bỏ nút Lưu theo lô
- [ ] Grep `"chưa lưu gì"` và `"refresh"` trong `apps/web` → 0 kết quả
- [ ] File ≤200 dòng, hoặc đã tách module
- [ ] `pnpm lint` · `pnpm typecheck` · `pnpm build` xanh

## Risk Assessment

| Rủi ro | Giảm thiểu |
| --- | --- |
| Bỏ nút "Lưu theo lô" là đổi UX ngoài phạm vi brainstorm | Đã khai ở mục Architecture như quyết định phát sinh + ghi ADR-0037. Nếu người quyết định không đồng ý thì giữ `picked`, chi phí bằng 0 |
| e2e cần key thật | `FixtureSourceDiscovery` là đường không-key; xác nhận trước khi viết spec, không giả định |
| Panel full-width đẩy Vùng đọc lên, ai đó tưởng mất tính năng | Panel ở **dưới** grid nên Vùng đọc không di chuyển; kiểm bằng mắt trên 1440px và 390px |
| File phình >200 dòng | Tách sẵn hai panel thành hai file ngay từ đầu thay vì refactor sau |
