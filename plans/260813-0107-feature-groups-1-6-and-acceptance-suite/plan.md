---
title: "Sáu nhóm tính năng + bộ nghiệm thu 10 điểm"
status: in-progress
priority: P1
effort: large
branch: master
tags: [nhom-1, nhom-2, nhom-3, nhom-4, nhom-5, nhom-6, nghiem-thu]
created: 2026-08-13
mode: tdd
scope: project
blockedBy: []
blocks: []
source: plans/reports/project-status-post-skeleton-260813-0101-feature-groups-critical-path-report.md
---

# Sáu nhóm tính năng + bộ nghiệm thu 10 điểm

> Nối tiếp [plan skeleton](../260812-1912-base-project-walking-skeleton/plan.md) (đã đóng, 6/6 điểm nghiệm thu).
> Quyết định chi phối: [ADR-0014](../../docs/decisions/0014-nhom-2-rut-phat-hien-bang-llm-that-code-kiem-cau-trich.md) (LLM thật + code kiểm chuỗi con) · [ADR-0013](../../docs/decisions/0013-seed-theo-du-lieu-tu-dat-chap-nhan-migrate-khi-btc-giao-du-lieu.md) (seed tự đặt) · [ADR-0010](../../docs/decisions/0010-chan-tang-csdl-bang-hai-role-va-quyen-theo-cot.md) + [ADR-0004](../../docs/decisions/0004-chan-ranh-gioi-o-tang-domain-va-tang-csdl.md) (chặn hai lớp).
> Ba quyết định mới từ phiên phản biện P1 ngày 13/08 ([báo cáo](../reports/from-brainstorm-to-planner-260813-0127-phase-01-grant-insert-theo-cot-va-ba-quyet-dinh-report.md)): [ADR-0015](../../docs/decisions/0015-grant-insert-phai-theo-cot-khi-bang-co-cot-thuoc-quyet-dinh-cua-nguoi.md) (`GRANT INSERT` theo cột) · [ADR-0016](../../docs/decisions/0016-proposal-status-chi-hai-gia-tri-moi-con-so-do-lay-tu-proposal-decisions.md) (`status = pending|decided`) · [ADR-0017](../../docs/decisions/0017-i3-enforce-o-tang-service-rang-buoc-csdl-chi-danh-cho-ranh-gioi.md) (I-3 ở service, không `UNIQUE`).
> Thiết kế P3 chốt 13/08 12:15 ([báo cáo](../reports/from-brainstorm-to-planner-260813-1215-phase-03-nhom-1-crm-lam-tay-report.md)): cờ cảnh báo suy ra không lưu cột · kéo thả dnd-kit không kèm Select, KeyboardSensor làm đường lái T-1 · đầu mối chính tự hạ người cũ · tổng quan thêm khối lý do thua. **Hai quyết định đầu còn nợ ADR.**

## Mục tiêu

Sáu nhóm tính năng của Specs mục 4 chạy được trên stack production, và **bộ nghiệm thu 10 điểm** của Specs mục 6 chạy bằng một lệnh. Hiện có 1/10 (T-10 mini).

**Feature freeze tối 14/08.** 15/08 chỉ hardening + demo, vòng 1 chốt 15:00.

## Ngân sách — nói thẳng chỗ không vừa

3 người × 2 ngày. Cộng ước lượng: **~27h việc / ~24h năng lực**. Âm đệm.

Đường găng: **P1a (1.5h) → P2 nhóm 2 (3h) → P6 nhóm 4 (3h) → P8 nghiệm thu (4h) = 11.5h**, phần lớn trên vai A. P1b (1.5h) chạy song song nên không vào đường găng, nhưng **phải xanh trước P5/P6/P7**.

Ước lượng P1 đã sửa từ 60' lên 1.5h + 1.5h sau phiên phản biện 13/08 — cộng thật là ~3h, và 60' là con số đoán.

**Cập nhật 13/08 02:20 — P1a + P1b xong trong ~20', không phải 3h.** P1b không cần chạy song song vì làm liền được. Đội **không bị chặn** và đệm âm được trả lại: quay về ~24h việc / 24h năng lực. Đừng đọc con số này thành "ước lượng luôn thừa" — nó thừa vì P1 là việc thuần schema + SQL, không có ẩn số nghiệp vụ nào; P2 (LLM thật) và P8 (nghiệm thu) không có tính chất đó.

Cắt theo đúng thứ tự này nếu tới **trưa 14/08** mà P4/P5 chưa xong:

1. Kéo thả giai đoạn → **chỉ giữ đường bàn phím của dnd-kit** (nhóm 1). Specs đòi kéo thả, nhưng T-1 chỉ đòi đổi được qua ba giai đoạn — mất điểm sản phẩm, không mất điểm nghiệm thu. Không quay về dropdown: [P3 đã loại phương án Select](phase-03-nhom-1-crm-lam-tay.md#quyết-định-đã-chốt), thêm lại là hai đường đổi giai đoạn cho cùng một việc.
2. Dòng tổng hợp cộng dồn mỗi 10 vòng (nhóm 5).
3. Màn tổng quan còn 3 con số (nhóm 1).
4. Nhóm 6 gộp còn một trang số liệu thô, không biểu đồ.

**Không cắt, kể cả trượt:** T-1…T-10 · provenance bấm ra được nguồn · hàng đợi duyệt · Hoàn tác 7 ngày · nút tắt AI. Đây là những chỗ rubric chấm hành vi.

## Phases

| # | Phase | Trạng thái | Người | Ước lượng | Phụ thuộc |
| --- | --- | --- | --- | --- | --- |
| 1a | [Seam — 7 bảng, GRANT theo cột, contracts](phase-01-seam-bay-bang-con-lai-grant-va-contracts.md#p1a--mở-khoá-đội-15h) | **done** | 1 người, **cả đội chờ** | 1.5h (thực: ~20') | — |
| 1b | [Ma trận chiều-cấm + 3 phép đo đột biến](phase-01-seam-bay-bang-con-lai-grant-va-contracts.md#p1b--song-song-phải-xanh-trước-p5p6p7-15h) | **done** | cùng người, **song song** | 1.5h (thực: gộp vào 1a) | 1a |
| 2 | [Nhóm 2 — bản lưu + phát hiện + provenance](phase-02-nhom-2-ban-luu-phat-hien-provenance.md) | **done** | A | 3h (thực: ~25') | 1a |
| 3 | [Nhóm 1 — CRM làm tay](phase-03-nhom-1-crm-lam-tay.md) | **done** | B | 5h (thực: ~2h45') | 1a |
| 4 | [Seed bản chụp trước/sau + T-1](phase-04-seed-ban-chup-truoc-sau-va-t1.md) | pending | C | 2h | 1a, (3 cho T-1) |
| 5 | [Nhóm 3 — hàng đợi gợi ý](phase-05-nhom-3-hang-doi-goi-y.md) | pending | B | 3h | 2, **1b** |
| 6 | [Nhóm 4 — tự đặt Việc tiếp theo + Hoàn tác](phase-06-nhom-4-tu-dat-viec-tiep-theo.md) | pending | A | 3h | 2, **1b** |
| 7 | [Nhóm 5 — vòng quét ghi dòng thời gian](phase-07-nhom-5-vong-quet-ghi-dong-thoi-gian.md) | pending | C | 2h | 2, 4, **1b** |
| 8 | [Nhóm 6 — bảng điều khiển + đóng T-1…T-10](phase-08-nhom-6-bang-dieu-khien-va-bo-nghiem-thu.md) | pending | cả đội | 4h | 5, 6, 7 |

```
P1a (cả đội chờ, 1.5h)
 ├── P1b (song song, 1.5h) ──────── phải xanh TRƯỚC P5/P6/P7 ──┐
 ├── A: P2 nhóm 2 ──────────┬── P6 nhóm 4 ──┐                  │
 ├── B: P3 nhóm 1 ──────────┴── P5 nhóm 3 ──┼── P8 nhóm 6 + T-1..T-10
 └── C: P4 seed fixture ─────── P7 nhóm 5 ──┘
```

Hai phụ thuộc cứng:

- **P5, P6, P7 đều cần `Claim` của P2.** P3 và P4 không cần.
- **P5, P6, P7 đều cần P1b xanh**, không phải P8. P6 (Hoàn tác) và P5 (duyệt) ăn trực tiếp `undo_deadline` và `status` — hai cột mà GRANT theo cột của [ADR-0015](../../docs/decisions/0015-grant-insert-phai-theo-cot-khi-bang-co-cot-thuoc-quyet-dinh-cua-nguoi.md) đang bảo vệ. Dồn ma trận chiều-cấm sang P8 là để hở đúng chỗ rubric chấm.

### Mốc thời gian

| Khi | Phải xong |
| --- | --- |
| ~~13/08 sáng~~ | ~~P1a~~ · ~~P1b~~ — **xong 13/08 02:20, cả hai. Đội mở khoá, fan-out được ngay** |
| 13/08 hết ngày | ~~P2~~ · ~~P3~~ · P4 |
| 14/08 trưa | P5, P6, P7 (P1b đã xanh nên không còn chặn). Chưa xong → cắt theo danh sách trên |
| 14/08 tối | P8, **freeze** |

## Chủ quyền file — chống đụng nhau

| Người | Sở hữu |
| --- | --- |
| A | `apps/api/src/domain/observation/`, `domain/claim/`, `src/ai/`, `domain/opportunity/auto-next-step*`, `apps/web/src/app/cong-ty/[id]/` khu vùng đọc, `apps/web/src/components/provenance/` |
| B | `apps/api/src/domain/{company,contact,opportunity,timeline}/` (trừ auto-next-step), `domain/proposal/`, `apps/web/src/app/{cong-ty,co-hoi,tong-quan,hang-doi}/` |
| C | `packages/db/src/seed/`, `apps/api/src/watch/`, `apps/web/src/app/quan-tri/`, `e2e/` |

**File dùng chung — sửa nhỏ, pull trước khi push, không refactor:** `packages/contracts/src/index.ts` · `packages/db/src/schema/index.ts` · `apps/api/src/app.module.ts` · nav của web.

## Luật áp cho mọi phase

Rút từ hai lỗi thật ngày 12/08 (xem [báo cáo nghiệm thu](../reports/walking-skeleton-acceptance-260812-2210-sau-diem-nghiem-thu-va-hai-loi-that-report.md)):

1. **Hàm nhận `actor` thì chọn pool theo `actor`.** Ghi cứng `dbApp` = chỉ còn một lớp chặn. Đây là lỗi đã bắt được, không phải rủi ro giả thiết.
2. **Mỗi đường ghi mới chạy phép đo đột biến**: xoá dòng kiểm → test phải đỏ. Không suy diễn từ đường ghi cũ.
3. **Bảng mới mà nhóm 4/5 cần ghi thì phải thêm GRANT tay** trong migration. `crm_system` không có `ALTER DEFAULT PRIVILEGES` — quên GRANT thì AI mất quyền (an toàn), không bao giờ tự có quyền (lỗ im lặng).
4. **Test T-x viết cùng phase**, không dồn sang P8. P8 chỉ gom và chạy đủ.
5. **Không hiển thị nhận định AI nào không bấm ra được nguồn.** Ép ở tầng component.

## Nghiệm thu toàn plan

`pnpm test` xanh, đủ 10 điểm Specs mục 6, phủ bởi phase nào:

| # | Nội dung | Phase |
| --- | --- | --- |
| T-1 | Tắt AI, nhóm 1 chạy đủ: công ty/liên hệ/cơ hội, kéo qua 3 giai đoạn có Đủ điều kiện, bỏ 2 ô dấu hiệu vẫn kéo được + có cờ, ghi hoạt động, tìm/lọc, màn tổng quan | 3, 4 |
| T-2 | Phát hiện thiếu câu trích không lưu được — thử ghi thẳng, phải bị từ chối | 2 ✅ |
| T-3 | Bấm phát hiện → mở đúng đoạn gốc, có đánh dấu | 2 ✅ e2e |
| T-4 | Sinh gợi ý rồi không làm gì; sau ≥3 chu kỳ hồ sơ y nguyên | 5 |
| T-5 | Duyệt / Sửa-rồi-duyệt / Bỏ đều có bản ghi; *sửa* không cộng vào *duyệt* | 5 |
| T-6 | Đổi bản chụp sang bản "sau" → Việc tiếp theo tự đổi, có thông báo, ô mang dấu hiệu hệ thống | 6 |
| T-7 | Hoàn tác một cú bấm, giá trị cũ trở lại; có bản ghi hai chiều | 6 |
| T-8 | 3 công ty Đang theo dõi, đổi nguồn 2 công ty → trong 2 chu kỳ có 2 mục mới, Nhật ký có dòng từng vòng | 7 |
| T-9 | Tắt AI giữa lúc vòng quét chạy: 2 chu kỳ sau không thêm gì, dữ liệu còn nguyên, Sales thấy banner; bật lại chạy tiếp, cả hai lần có ghi vết | 8 |
| T-10 | Đổi giai đoạn / đổi giá trị tiền / xoá công ty dưới danh nghĩa hệ thống, không qua UI → cả ba bị từ chối | 8 (mở rộng T-10 mini) |

## Ngoài phạm vi

CI/CD · triển khai đám mây · phân quyền theo người sở hữu (một tài khoản Sales sở hữu mọi công ty, ontology mục 1) · ma trận quyền chi tiết của Admin (Q-6 còn treo) · crawl web thật (đọc bản chụp trong seed) · soạn message tiếp cận · chatbot.

## Rủi ro

| Rủi ro | Xử lý |
| --- | --- |
| ~~LLM trả câu trích diễn giải thay vì nguyên văn → claim bị bỏ hàng loạt~~ | **Đã đo 13/08 11:28, cửa chặn P5/P6 mở: 0/11 draft bị bỏ.** Mẫu nhỏ (11 draft, `claude-haiku-4-5`) — đổi model hay bản chụp dài hơn thì đo lại, chỉ số có sẵn trong mọi response |
| Quên GRANT cho bảng mới → nhóm 4/5 ghi không được | Smoke **chiều-cho** nằm trong P1a (không hoãn sang P1b); ma trận đầy đủ hai chiều ở P1b |
| `GRANT INSERT` mức bảng lọt vào → AI tự duyệt gợi ý, đè `undo_deadline`, tự đánh dấu đã đọc | Cùng cấu trúc lỗi ADR-0010 đã bắt trên `UPDATE`, lần này trên `INSERT` ([ADR-0015](../../docs/decisions/0015-grant-insert-phai-theo-cot-khi-bang-co-cot-thuoc-quyet-dinh-cua-nguoi.md)). Phép đo đột biến số 3 ở P1b là cách duy nhất biết — review bằng mắt đã trượt một lần |
| `UNIQUE (company_id, content_hash)` chặn giám khảo diễn lại T-6/T-8 lần hai | Đã loại ở [ADR-0017](../../docs/decisions/0017-i3-enforce-o-tang-service-rang-buoc-csdl-chi-danh-cho-ranh-gioi.md); P2 phải có test ca trước→sau→trước |
| Nhóm 1 phình ra ăn hết ngày 13 | Cắt kéo thả trước, cắt màn tổng quan sau. Ranh giới cắt ghi ở mục Ngân sách |
| Vòng quét gọi LLM chậm hơn nhịp 60s | Đã có luật bỏ nhịp + `skipped_reason` của ADR-0011. P7 test đúng kịch bản này |
| Ba phép đo đột biến còn nợ từ plan skeleton | P1b trả nợ GRANT + enum (cộng một phép đo mới cho ADR-0015); `@Cron` trả trong P7 |

## Validation Log

### Phiên 1 — 13/08 12:15, phạm vi Phase 3

**Verification Results** — Claims checked: 9 · Verified: 9 · Failed: 0 · Unverified: 0 · Tier: Full (giới hạn Phase 3)

Xác minh đáng ghi lại: FK `timeline_entries.contact_id` **`ON DELETE no action`** (`0002_closed_cyclops.sql:112`) — bẫy xoá người liên hệ là thật, không phải giả thiết. Partial unique index đầu mối chính có trong migration (`:108`). Token `--color-warning` + `--color-warning-surface` có sẵn (`globals.css:84-85`).

**Phát hiện ngoài danh sách claim:** `vitest.config.mts` chỉ collect `packages/*` và `apps/api` — **`apps/web` không có project nào**, nên mọi màn hình đều không có test đơn vị.

**Bốn quyết định chốt:**

| Câu hỏi | Chốt | Hệ quả lan ra |
| --- | --- | --- |
| "Đã qua qualified" nghĩa là gì | Tập cố định `{qualified, drafting, negotiation, won}`, không đọc dòng thời gian | Chấp nhận: deal qualified rồi tạm dừng mất cờ. Đổi lại hàm suy cờ vẫn thuần, không JOIN |
| Ô nguồn của hai dấu hiệu | **Đủ = cả bốn ô** (chọn chặt hơn khuyến nghị) | P4: seed phải có cơ hội đủ bốn ô, không thì mọi cơ hội đều mang cờ và demo chỉ thấy một trạng thái |
| Web P3 không có test trong phase | Dựa vào T-1 e2e của P4, ghi là nợ có chủ ý | Luật số 4 cấm dồn sang **P8**, không cấm đặt ở P4. Điều kiện: chạy tay đủ checklist trước khi đóng phase |
| `PATCH /companies/:id` sửa ô nào | Mọi ô, kể cả `companyType` — I-11 chỉ ràng buộc Proposal | Đóng một câu hỏi treo của P3, không còn đẩy sang P5 |

**Whole-Plan Consistency Sweep** — quét `plan.md` + 8 phase file. Hai mâu thuẫn phát hiện, cả hai đã hoà giải: (1) T-1 e2e của P4 mô tả kéo thả bằng chuột, sửa sang đường bàn phím theo quyết định dnd-kit của P3; (2) `SEED_OPPORTUNITIES` không có ô dấu hiệu nào trong khi P3 chốt "đủ = cả bốn ô", đã thành yêu cầu của P4. **Không còn mâu thuẫn tồn đọng.**

~~**Còn nợ ADR:** cờ suy ra không lưu cột · dnd-kit không kèm Select~~ — **đã trả 13/08 17:20**: [ADR-0019](../../docs/decisions/0019-co-canh-bao-suy-ra-tu-cot-null-khong-luu-thanh-cot.md) · [ADR-0020](../../docs/decisions/0020-doi-giai-doan-chi-bang-keo-tha-dnd-kit-duong-ban-phim-la-duong-lai-cua-t1.md).

### Phiên 2 — 13/08 17:20, P3 đóng

**158 test đơn vị + 6 e2e xanh**, typecheck/lint/build xanh, ba phép đo đột biến đều cắn. Ba việc đáng mang sang phase khác:

- **P4 đọc [ADR-0020](../../docs/decisions/0020-doi-giai-doan-chi-bang-keo-tha-dnd-kit-duong-ban-phim-la-duong-lai-cua-t1.md) trước khi viết T-1.** Đường bàn phím cần khoảng cách giữa các phím (0ms không chuyển, ≥50ms chuyển). Bấm liền nhau thì T-1 đỏ vì harness, không vì sản phẩm — đúng loại lỗi tốn nhiều giờ nhất vào ngày cuối.
- **P3 đã sửa 3 dòng trong `e2e/login-and-create-company.spec.ts`** (file của C): bộ lọc mới làm `getByLabel('Ngành')` khớp 2 phần tử, đã giới hạn vào `getByRole('dialog')`.
- **Seed vẫn chưa có cơ hội `qualified` đủ bốn ô dấu hiệu**, nên hiện mọi cơ hội trên bảng đều mang cờ — demo chỉ thấy một trạng thái. Yêu cầu này thuộc P4 và giờ **nhìn thấy được trên màn hình**, không còn là suy đoán.

## Câu hỏi chưa giải quyết

- **Q-6: Admin có được thao tác CRM không** — chặn ma trận quyền của nhóm 6. P8 tạm làm: Admin xem được tất cả, không sửa dữ liệu Sales.
- Format bộ dữ liệu BTC — [ADR-0013](../../docs/decisions/0013-seed-theo-du-lieu-tu-dat-chap-nhan-migrate-khi-btc-giao-du-lieu.md) đã quyết không chờ. Khi dữ liệu về thì thay `seed-data.ts`.
- Telemetry của thành viên 2 và 3 chưa verify trên Grafana (README mục Telemetry). **Không phải việc của plan này nhưng là điều kiện qua vòng 1** — mỗi người tự kiểm trước khi gõ dòng đầu.
