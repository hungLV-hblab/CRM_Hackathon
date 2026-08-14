---
title: "Sáu nhóm tính năng + bộ nghiệm thu 10 điểm"
status: done
priority: P1
effort: large
branch: master
tags: [nhom-1, nhom-2, nhom-3, nhom-4, nhom-5, nhom-6, nghiem-thu]
created: 2026-08-13
mode: tdd
scope: project
blockedBy: []
blocks: [260814-0056-nang-cap-ui-shadcn-shell-tour]
source: plans/reports/project-status-post-skeleton-260813-0101-feature-groups-critical-path-report.md
---

# Sáu nhóm tính năng + bộ nghiệm thu 10 điểm

> Nối tiếp [plan skeleton](../260812-1912-base-project-walking-skeleton/plan.md) (đã đóng, 6/6 điểm nghiệm thu).
> Quyết định chi phối: [ADR-0014](../../docs/decisions/0014-nhom-2-rut-phat-hien-bang-llm-that-code-kiem-cau-trich.md) (LLM thật + code kiểm chuỗi con) · [ADR-0013](../../docs/decisions/0013-seed-theo-du-lieu-tu-dat-chap-nhan-migrate-khi-btc-giao-du-lieu.md) (seed tự đặt) · [ADR-0010](../../docs/decisions/0010-chan-tang-csdl-bang-hai-role-va-quyen-theo-cot.md) + [ADR-0004](../../docs/decisions/0004-chan-ranh-gioi-o-tang-domain-va-tang-csdl.md) (chặn hai lớp).
> Ba quyết định mới từ phiên phản biện P1 ngày 13/08 ([báo cáo](../reports/from-brainstorm-to-planner-260813-0127-phase-01-grant-insert-theo-cot-va-ba-quyet-dinh-report.md)): [ADR-0015](../../docs/decisions/0015-grant-insert-phai-theo-cot-khi-bang-co-cot-thuoc-quyet-dinh-cua-nguoi.md) (`GRANT INSERT` theo cột) · [ADR-0016](../../docs/decisions/0016-proposal-status-chi-hai-gia-tri-moi-con-so-do-lay-tu-proposal-decisions.md) (`status = pending|decided`) · [ADR-0017](../../docs/decisions/0017-i3-enforce-o-tang-service-rang-buoc-csdl-chi-danh-cho-ranh-gioi.md) (I-3 ở service, không `UNIQUE`).
> Thiết kế P3 chốt 13/08 12:15 ([báo cáo](../reports/from-brainstorm-to-planner-260813-1215-phase-03-nhom-1-crm-lam-tay-report.md)): cờ cảnh báo suy ra không lưu cột · kéo thả dnd-kit không kèm Select, KeyboardSensor làm đường lái T-1 · đầu mối chính tự hạ người cũ · tổng quan thêm khối lý do thua. ADR trả 13/08 17:20: [ADR-0019](../../docs/decisions/0019-co-canh-bao-suy-ra-tu-cot-null-khong-luu-thanh-cot.md) · [ADR-0020](../../docs/decisions/0020-doi-giai-doan-chi-bang-keo-tha-dnd-kit-duong-ban-phim-la-duong-lai-cua-t1.md).
> Thiết kế P5 chốt 13/08 20:51 ([báo cáo](../reports/from-brainstorm-to-planner-260813-2051-phase-05-nhom-3-hang-doi-goi-y-report.md)): [ADR-0023](../../docs/decisions/0023-goi-y-viec-tiep-theo-la-proposal-type-thu-ba-kem-cot-opportunity-id.md) (I-7 cần `proposal_type = next_step` + cột `opportunity_id` — **không có nó Proposal của nhóm 4 không lưu được**) · [ADR-0024](../../docs/decisions/0024-goi-y-sua-o-ho-so-do-llm-de-xuat-code-giu-ba-cua-chan.md) (`field_update`: LLM đề xuất + ba cửa chặn code) · [ADR-0025](../../docs/decisions/0025-moc-do-thoi-gian-quyet-dat-lai-sau-moi-quyet-dinh.md) (mốc `seconds_to_decide` đặt lại sau mỗi quyết định, **ontology mục 7 đã sửa**).
> Thiết kế P4 chốt 13/08 19:56 ([báo cáo](../reports/from-brainstorm-to-planner-260813-1956-GH-3-phase-04-seed-ban-chup-va-t1-report.md)): [ADR-0021](../../docs/decisions/0021-ban-chup-demo-giu-dang-hang-so-typescript-khong-tach-thanh-file-html.md) (bản chụp giữ dạng hằng số TS, không tách HTML) · [ADR-0022](../../docs/decisions/0022-ban-chup-hien-tai-la-cot-text-tren-companies-khong-phai-enum-cua-ontology.md) (cột `snapshot_variant` — **P4 làm thay P7, không có nó T-8 không đóng được**).

## Mục tiêu

Sáu nhóm tính năng của Specs mục 4 chạy được trên stack production, và **bộ nghiệm thu 10 điểm** của Specs mục 6 chạy bằng một lệnh. ~~Hiện có 1/10 (T-10 mini).~~ **Đạt 10/10 lúc 14/08 11:30.**

**Feature freeze tối 14/08.** 15/08 chỉ hardening + demo, vòng 1 chốt 15:00.

## Ngân sách — nói thẳng chỗ không vừa

3 người × 2 ngày. Cộng ước lượng: **~27h việc / ~24h năng lực**. Âm đệm.

Đường găng: **P1a (1.5h) → P2 nhóm 2 (3h) → P6 nhóm 4 (~~3h~~ 4h) → P8 nghiệm thu (4h) = ~~11.5h~~ 12.5h**, phần lớn trên vai A. **Cả năm chặng đã xong, đường găng đóng 14/08 11:30.** P1b (1.5h) chạy song song nên không vào đường găng, nhưng **phải xanh trước P5/P6/P7**.

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
| 4 | [Seed bản chụp trước/sau + T-1](phase-04-seed-ban-chup-truoc-sau-va-t1.md) | **done** | C | 2h15 (thực: ~1h20') | 1a, (3 cho T-1) |
| 5 | [Nhóm 3 — hàng đợi gợi ý](phase-05-nhom-3-hang-doi-goi-y.md) | **done** | B | ~~3h~~ 4.5h (thực: ~1h20') | 2, **1b** |
| 6 | [Nhóm 4 — tự đặt Việc tiếp theo + Hoàn tác](phase-06-nhom-4-tu-dat-viec-tiep-theo.md) | **done** | A | ~~3h~~ 4h (thực: ~30') | 2, 5, **1b** |
| 7 | [Nhóm 5 — vòng quét ghi dòng thời gian](phase-07-nhom-5-vong-quet-ghi-dong-thoi-gian.md) | **done** | C | ~~2h~~ 3h (thực: ~1h10') | 2, 4, **1b** |
| 8 | [Nhóm 6 — bảng điều khiển + đóng T-1…T-10](phase-08-nhom-6-bang-dieu-khien-va-bo-nghiem-thu.md) | **done** | cả đội, **song song ~2.5h** | 4h30 (thực: ~50') | 5, 6, 7 |

```
P1a (cả đội chờ, 1.5h)
 ├── P1b (song song, 1.5h) ──────── phải xanh TRƯỚC P5/P6/P7 ──┐
 ├── A: P2 nhóm 2 ──────────┬── P6 nhóm 4 ──┐                  │
 ├── B: P3 nhóm 1 ──────────┴── P5 nhóm 3 ──┼── P8 nhóm 6 + T-1..T-10
 └── C: P4 seed fixture ─────── P7 nhóm 5 ──┘
```

Ba phụ thuộc cứng:

- **P5, P6, P7 đều cần `Claim` của P2.** P3 và P4 không cần.
- **P7 cần cột `companies.snapshot_variant` của P4.** Vòng quét tự chạy nên không nhận tham số từ ai; không có chỗ lưu bản chụp hiện tại thì nó không biết đọc bản nào và **T-8 không đóng được như đề bài viết** ([ADR-0022](../../docs/decisions/0022-ban-chup-hien-tai-la-cot-text-tren-companies-khong-phai-enum-cua-ontology.md)). P4 tạo cột + đường đổi, P7 tiêu thụ.
- **P5, P6, P7 đều cần P1b xanh**, không phải P8. P6 (Hoàn tác) và P5 (duyệt) ăn trực tiếp `undo_deadline` và `status` — hai cột mà GRANT theo cột của [ADR-0015](../../docs/decisions/0015-grant-insert-phai-theo-cot-khi-bang-co-cot-thuoc-quyet-dinh-cua-nguoi.md) đang bảo vệ. Dồn ma trận chiều-cấm sang P8 là để hở đúng chỗ rubric chấm.

### Mốc thời gian

| Khi | Phải xong |
| --- | --- |
| ~~13/08 sáng~~ | ~~P1a~~ · ~~P1b~~ — **xong 13/08 02:20, cả hai. Đội mở khoá, fan-out được ngay** |
| 13/08 hết ngày | ~~P2~~ · ~~P3~~ · ~~P4~~ — **cả ba xong 13/08 20:35. P5/P6/P7 mở khoá hết** |
| ~~14/08 trưa~~ | ~~P5~~ · ~~P6~~ — **P6 xong 14/08 00:44**. Còn P7 (P1b đã xanh nên không còn chặn). Chưa xong → cắt theo danh sách trên |
| ~~14/08 trưa~~ | ~~P7~~ — **xong 14/08 03:38. P8 mở khoá hết** |
| ~~14/08 tối~~ | ~~P8~~ — **xong 14/08 11:30, sớm hơn freeze gần một ngày. 10/10 điểm nghiệm thu xanh** |

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
| T-1 | Tắt AI, nhóm 1 chạy đủ: công ty/liên hệ/cơ hội, kéo qua 3 giai đoạn có Đủ điều kiện, bỏ 2 ô dấu hiệu vẫn kéo được + có cờ, ghi hoạt động, tìm/lọc, màn tổng quan. **Một spec, mỗi chặng một `test.step()`**; lái bằng bàn phím, giãn ≥50ms giữa phím (ADR-0020) | 3, 4 ✅ e2e |
| T-2 | Phát hiện thiếu câu trích không lưu được — thử ghi thẳng, phải bị từ chối | 2 ✅ |
| T-3 | Bấm phát hiện → mở đúng đoạn gốc, có đánh dấu | 2 ✅ e2e |
| T-4 | Sinh gợi ý rồi không làm gì; sau ≥3 chu kỳ hồ sơ y nguyên | 5 ✅ |
| T-5 | Duyệt / Sửa-rồi-duyệt / Bỏ đều có bản ghi; *sửa* không cộng vào *duyệt* | 5 ✅ e2e |
| T-6 | Đổi bản chụp sang bản "sau" → Việc tiếp theo tự đổi, có thông báo, ô mang dấu hiệu hệ thống | 6 ✅ e2e |
| T-7 | Hoàn tác một cú bấm, giá trị cũ trở lại; có bản ghi hai chiều | 6 ✅ e2e |
| T-8 | 3 công ty Đang theo dõi, đổi nguồn 2 công ty → trong 2 chu kỳ có 2 mục mới, Nhật ký có dòng từng vòng | 7 ✅ e2e |
| T-9 | Tắt AI giữa lúc vòng quét chạy: 2 chu kỳ sau không thêm gì, dữ liệu còn nguyên, Sales thấy banner; bật lại chạy tiếp, cả hai lần có ghi vết | 8 ✅ e2e |
| T-10 | Đổi giai đoạn / đổi giá trị tiền / xoá công ty dưới danh nghĩa hệ thống, không qua UI → cả ba bị từ chối | 8 ✅ hai lớp |

**10/10 xanh bằng một lệnh `pnpm test`** — 281 test đơn vị + 32 e2e, 14/08 11:30.

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
| ~~Ba phép đo đột biến còn nợ từ plan skeleton~~ | **Trả hết.** P1b trả GRANT + enum (cộng một phép đo mới cho ADR-0015); `@Cron` đã trả 12/08 trên stack thật ngay trong ADR-0011 — P7 **không** phải trả lại, chỉ thêm đột biến `scheduleNextTick(60)` cứng |

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

### Phiên 3 — 13/08 19:56, phạm vi Phase 4

Phase 4 viết **trước khi P2 xong** nên đã lệch với code thật ở 8 chỗ ([báo cáo](../reports/from-brainstorm-to-planner-260813-1956-GH-3-phase-04-seed-ban-chup-va-t1-report.md)). Kiểm bằng đọc mã nguồn, không phải chạy đo.

**Bốn hạng mục bỏ vì đã có sẵn:** bản chụp đã tồn tại (`apps/api/src/ai/demo-snapshots.ts`, 4 công ty × before/after) · dọn I-14 đã xong (`seed()` TRUNCATE đủ 15 bảng của `ALL_TABLES`) · I-3 đã có test 6 + test 7 nên bỏ yêu cầu "bản sau byte-identical" · ca `fetch_status = failed` đã có (Ohara `rawHtml: ''`).

**Một lỗ hổng bịt lại:** `variant` là **tham số request**, vòng quét không nhận tham số ⇒ **T-8 không đóng được**. P4 thêm cột `companies.snapshot_variant` + module `apps/api/src/demo/`, P7 tiêu thụ.

**Một sai sót thật trong bản phase cũ:** bảng bản chụp gán tin `funding` cho `tech_startup` rồi mong nó tự đặt Việc tiếp theo. Sai — I-6 không đọc loại công ty, nó đọc `signal_type` + có cơ hội mở. Phân bố hiện tại của P2 mới đúng: Sakura (có next step người gõ) + funding → **Proposal** theo I-7; Nimbus (next step trống) + leadership_hire → **tự đặt** = T-6/T-7; Kitefin + expansion → hàng đợi.

**Bốn quyết định chốt:**

| Câu hỏi | Chốt | Hệ quả lan ra |
| --- | --- | --- |
| Bản chụp ở đâu, dạng gì | Giữ hằng số TS, mở rộng `demo-snapshots.ts` ([ADR-0021](../../docs/decisions/0021-ban-chup-demo-giu-dang-hang-so-typescript-khong-tach-thanh-file-html.md)) | ADR-0013 thành "thay **2** file" khi dữ liệu BTC về. P4 (C) sửa một file của A — ngoại lệ có ý thức với bảng chủ quyền |
| "Bản chụp hiện tại" lưu ở đâu | Cột `companies.snapshot_variant`, `text` + CHECK, **không** vào `ENUMS` ([ADR-0022](../../docs/decisions/0022-ban-chup-hien-tai-la-cot-text-tren-companies-khong-phai-enum-cua-ontology.md)) | 0 GRANT mới; I-14 tự đúng; `crm_system` không đổi được nguồn nó đọc → **phép đo GRANT mới, nợ trả trong P4** |
| T-1 tắt AI bằng gì | Helper SQL trong `e2e/` qua `DATABASE_URL_OWNER` | Nút tắt vẫn là T-9/P8, không kéo việc P8 vào phase đang chặn P7 |
| T-1 mấy spec | **Một spec** (khác khuyến nghị tách ba), bọc `test.step()` từng chặng | Giữ "đi hết luồng" mà reporter vẫn chỉ ra chặng đỏ |

**Việc kèm bắt buộc:** `seed-idempotent.test.ts` hardcode số công ty **5/4 → 6/5**. Seed còn thiếu thật: **0 contact · 0/12 ô dấu hiệu · 0 cơ hội `lost`**.

**Nợ đo, không phải nợ ADR:** "cột thêm sau được phủ bởi GRANT mức bảng" là suy luận từ ngữ nghĩa `GRANT` của Postgres, chưa đo trên `crm_test`. P4 đóng bằng phép đo: `crm_system` UPDATE `snapshot_variant` → từ chối, `crm_app` → thành công.

### Phiên 4 — 13/08 20:35, P4 đóng

**170 test đơn vị + 7 e2e xanh**, lint/typecheck xanh, T-1 đóng. Nợ đo của [ADR-0022](../../docs/decisions/0022-ban-chup-hien-tai-la-cot-text-tren-companies-khong-phai-enum-cua-ontology.md) đã trả kèm phép đo đột biến (GRANT `UPDATE (snapshot_variant)` cho `crm_system` → test đỏ; REVOKE → xanh). **P7 mở khoá:** cột `companies.snapshot_variant` đã có, `POST /demo/companies/:id/snapshot-variant` và `pnpm switch-snapshot` là hai đường đổi.

Bốn việc mang sang phase khác:

- **P7 đọc cột, không đọc body.** `ObservationService.ingest()` và `ingestSnapshotSchema` **không đổi một dòng** — hai nguồn nói "đọc bản nào" là mùi đã chấp nhận có ý thức trong ADR-0022. Vòng quét phải `SELECT snapshot_variant` theo từng công ty.
- **Vòng quét giờ có 3 công ty theo dõi** (Sakura · Nimbus · Kitefin), tăng từ 1. Đúng yêu cầu T-8, nhưng nhịp 60s × 3 lần gọi LLM là việc P7 phải cân (ADR-0011 đã có luật bỏ nhịp).
- **Đừng tin một kết quả e2e khi container chưa build lại.** Bản web đang chạy lúc bắt đầu phase là bản 17 giờ trước, không có `ContactSection` của P3 — mất hai lượt chạy để phát hiện. `docker compose up --build` trước, rồi mới đọc kết quả.
- **`getByText` khớp chuỗi con.** `Đầu mối chính` khớp cả nút `Đặt làm đầu mối chính`; `getByLabel('Dấu hiệu nhu cầu')` khớp cả `Nguồn của dấu hiệu nhu cầu`. Dùng `{ exact: true }` cho mọi nhãn là tiền tố của nhãn khác — P8 gom bộ nghiệm thu sẽ gặp lại.

**Công ty #5 (Marlin Product Labs, `it_product`) đã làm** thay vì cắt: đoạn funding dùng chung một hằng số với Sakura, nên "cùng một tin, hai loại công ty" là số đo được chứ không phải lời kể.

### Phiên 5 — 13/08 20:51, phạm vi Phase 5

Phase 5 cũng viết **trước khi P2 xong** nên giả định "claim mới → sinh Proposal" là chuyện nối dây. Kiểm bằng đọc mã nguồn: **ba chỗ không nối được**, một trong đó làm hàng đợi trống lúc demo.

**Ba lỗ hổng:**

- **`Claim` không mang cặp (ô, giá trị)** ở bất kỳ đâu trong pipeline (`contracts/dto/claim.ts`, zod schema `anthropic-claim-extractor.ts:41-46`, hàng insert `claim-service.ts:81-91`), và grep `Ngành|Trụ sở|Quy mô|Website|nhân viên` trên cả 5 bản chụp trả **0 kết quả** ⇒ không có đường nào sinh `field_update`. Đường tắt duy nhất sai ngay ví dụ đầu: claim Kitefin *"mở rộng sang thị trường Nhật Bản"* → `country`, mà Kitefin trụ sở Hoa Kỳ (`seed-data.ts:65`).
- **I-5 làm hàng đợi trống:** 3/5 công ty seed `is_watched = true` ⇒ `timeline_entry` bị chặn cho cả ba. Còn Marlin (đầu danh sách cắt) và Ohara (`rawHtml: ''` cả hai biến thể). Không có `field_update` thì hàng đợi demo tối đa **1 thẻ**.
- **Proposal của I-7 không lưu được:** CHECK chỉ hai nhánh (`proposals.ts:51-56`) và bảng **không có `opportunity_id`**, trong khi Việc tiếp theo thuộc cơ hội.

**Bốn quyết định chốt:**

| Câu hỏi | Chốt | Hệ quả lan ra |
| --- | --- | --- |
| `field_update` lấy bằng chứng từ đâu | **Kết hợp**: bản chụp thêm khối dữ kiện → LLM đề xuất `fieldSuggestion` → code giữ ba cửa chặn ([ADR-0024](../../docs/decisions/0024-goi-y-sua-o-ho-so-do-llm-de-xuat-code-giu-ba-cua-chan.md)). Đội **bác** khuyến nghị "parser tất định" của AI vì nó đẩy AI ra khỏi nhóm 3 | B sửa 4 file của A và C. Nợ đo mới: tỉ lệ LLM trả `fieldSuggestion`, trả trong P5 |
| I-7 biểu diễn thế nào | `proposal_type = next_step` + cột `opportunity_id` + CHECK ba nhánh ([ADR-0023](../../docs/decisions/0023-goi-y-viec-tiep-theo-la-proposal-type-thu-ba-kem-cot-opportunity-id.md)) | **P6 mở khoá** — nhánh I-7 có chỗ hạ cánh. Cột mới ⇒ GRANT tay + phép đo đột biến thứ ba |
| Nối vào pipeline ở đâu | `ClaimReactionService`, `ObservationService` gọi **1 dòng** | P6 và P7 chỉ sửa file điều phối, không sửa hàm của A. Thứ tự nhóm 4 → nhóm 3 tường minh và test được |
| Mốc `seconds_to_decide` | Đặt lại sau **mỗi** quyết định ([ADR-0025](../../docs/decisions/0025-moc-do-thoi-gian-quyet-dat-lai-sau-moi-quyet-dinh.md)) — mốc chung làm trung vị thành hàm của độ dài hàng đợi | **Sửa ontology mục 7** (đã làm). P8: cột nullable, bảng điều khiển phải nói rõ mẫu bao nhiêu |

**Ước lượng sửa 3h → 4.5h**, nằm trên đường găng của B. Món cắt đầu tiên nếu trượt: `next_step` → đẩy sang P6 (enum thừa + cột NULL không cần migration ngược).

**Một câu treo, không chặn code:** I-4 cấm claim `manual_ingest` sinh `TimelineEntry` — duyệt một `timeline_entry` proposal là **người** ghi (`created_by = human`) nên đọc là ngoài phạm vi I-4. Đã ghi câu này vào ADR-0024 để vòng 2 không hỏi vào chỗ trống.

### Phiên 6 — 13/08 22:07, P5 đóng

**203 test đơn vị + 9 e2e xanh**, lint/typecheck sạch, ba phép đo đột biến đều cắn. Hàng đợi trên stack thật có **3 gợi ý** — Sakura `size` (ô cũ) · Kitefin `website` (ô trống) · Marlin một mục dòng thời gian. Hai nửa của Specs nhóm 3 đều nằm **trong** tập công ty đang theo dõi, nên không phụ thuộc Marlin (công ty đầu danh sách cắt).

**P6 mở khoá:** `proposal_type = next_step` + cột `opportunity_id` đã có, `BlockedNextStep` đã có kiểu, nhánh duyệt đã có test. `ClaimReactionService` để sẵn chỗ cho bước nhóm 4 **phía trên** bước nhóm 3.

Bốn việc mang sang phase khác — **ba trong số đó là bẫy sẽ gặp lại nguyên vẹn**:

- **`db.insert().values()` của drizzle không dùng được cho đường ghi của `crm_system`.** Nó liệt kê **mọi** cột của bảng, nên chỉ cần *nêu tên* `status` là Postgres từ chối cả câu lệnh. Cách sửa là viết `INSERT` nêu đúng cột được phép, **không** phải nới GRANT. **P6 sẽ đụng ngay**: `auto_next_step_events` có `undo_deadline` + 4 cột `undone_*` vắng khỏi GRANT theo đúng thiết kế ADR-0015.
- **`ALTER TYPE ... ADD VALUE` rồi dùng giá trị đó trong cùng transaction = lỗi 55P04**, mà drizzle chạy mọi migration trong một transaction ⇒ CHECK phải so `::text`. Không sửa thì migration vỡ trên **mọi CSDL mới** — mỗi lần chạy test, mỗi lần giám khảo diễn lại.
- **Phép đo trên bộ demo tìm ra lỗi thật mà test không thấy:** Kitefin ra hai thẻ y hệt (bản trước + bản sau cùng một dòng website). Luật chống sinh lại chỉ chặn nội dung *đã quyết*; đã sửa để gợi ý *đang chờ* cũng chặn bản trùng. **Chạy trên dữ liệu thật rồi mới tin, kể cả khi test xanh hết.**
- **Test parity ontology cắn** khi thêm `next_step` vào enum mà chưa sửa `docs/ontology.md` mục 3.5 — lớp chống "ontology trang trí" hoạt động thật.

**Nợ đo LLM thật đã trả, 13/08 22:32** (key do HungLV cấp, `claude-haiku-4-5`, 3 lượt × 10 lần đọc nguồn). Lượt đầu **G2 loại 2/3 đề xuất** — model gắn `fieldSuggestion` vào phát hiện tin tức, mà câu trích của tin không chứa giá trị của ô ⇒ hàng đợi mất thẻ `size` của Sakura. **Sửa prompt (thêm luật "mỗi đề xuất nằm trên một phát hiện riêng, câu trích phải là dòng dữ kiện" + ví dụ đúng/sai), không chạm G2** — đúng điều ADR-0024 đã dặn trước. Hai lượt sau: **G2 loại 0/3**, hàng đợi ra đúng 3 thẻ, hai lượt giống nhau từng dòng. Kèm hai số đo phụ: bộ chặn trùng cắn trên LLM thật (Kitefin đề xuất lại dòng website) và I-5 chặn 4 phát hiện thành `timeline_entry` trên 3 công ty đang theo dõi.

**Bài học mang sang P6/P7:** cửa chặn báo *đúng* nhưng con số hàng đợi mới nói cho biết **prompt** đang sai. Không có số đếm theo từng cửa thì lỗi này trông y như "LLM không tìm được gì".

### Phiên 7 — 14/08 00:20, phạm vi Phase 6

Phase 6 cũng viết **trước khi P2/P5 xong**, và lệch theo **hai chiều ngược nhau** ([báo cáo](../reports/from-brainstorm-to-planner-260813-2354-phase-06-nhom-4-tu-dat-viec-tiep-theo-report.md)). Kiểm bằng đọc mã nguồn.

**Hơn nửa backend đã có sẵn:** bảng + GRANT theo cột của `auto_next_step_events`/`notifications` (`0003:52-66`) · bảng độ gấp I-9 ở contracts · `dueDateFor()` đã xử lý bẫy UTC+7 · `BlockedNextStep` + nhánh `next_step` của hàng đợi · `NotificationDto` · chỗ trống chờ nhóm 4 trong `claim-reaction-service.ts:44`. Làm đúng phase file cũ sẽ tạo **bản sao thứ hai** của bảng độ gấp.

**Bù lại, phần web không được tính:** Specs đòi "thông báo trong sản phẩm" mà web **không có nav dùng chung, không có route thông báo**. Ước lượng **3h → 4h**, nằm trên đường găng của A.

**Sáu quyết định chốt:**

| Câu hỏi | Chốt | Hệ quả lan ra |
| --- | --- | --- |
| I-8 lấy mốc người-gõ ở đâu | **Lần ngược chuỗi event lúc hoàn tác**, không chép mốc sang mỗi hàng ([ADR-0026](../../docs/decisions/0026-hoan-tac-lan-nguoc-chuoi-event-de-tim-moc-nguoi-go.md)) | `previous_*` giữ đúng nghĩa "thứ có ngay trước tôi"; chép sang là để lại một cột nói dối cho người đọc sau |
| Nút Hoàn tác đặt ở đâu | **Trên thẻ cơ hội**, và màn thông báo vẫn phải làm ([ADR-0027](../../docs/decisions/0027-nut-hoan-tac-nam-tren-the-co-hoi-du-lieu-di-qua-endpoint-rieng.md)) | Phương án đắt nhất trong ba, chọn có ý thức — "sửa lại phải dễ hơn cả lúc máy làm" |
| Thẻ lấy dữ liệu bằng đường nào | **Endpoint riêng + gộp ở client** | `OpportunityDto`/`SELECTION`/`toDto` không đổi ⇒ không đụng file dùng chung của B trước freeze. Đổi lại bảng deal có hai nguồn |
| Bảng độ gấp I-9 | **Rút `dueDateFor` ra file dùng chung**, không tạo `urgency-table.ts` | "Đổi bảng → ngày hạn đổi theo" đúng ở cả hai đường: tự đặt và duyệt gợi ý |
| Thông báo khi công ty nhiều cơ hội mở | **Một thông báo / một event** | Giữ được "mỗi cơ hội một nút Hoàn tác riêng" của ADR-0005 B1; gộp ở tầng hiển thị |
| `on_hold` có phải cơ hội mở không | **Có**, đúng ontology 3.5 | Máy đặt việc cho cả deal tạm dừng. Muốn lệch thì phải có ADR, không sửa ngầm |

**Hai phép đo đột biến, một trong đó là nợ cũ:** ghi cứng `dbApp` → test hoàn tác-dưới-danh-nghĩa-system phải đổi màu · nới GRANT `undo_deadline` cho `crm_system` → test "AI không rút ngắn cửa sổ 7 ngày" phải đổi màu. Cột-list của `0003` chưa từng được đo.

**Một lỗ sản phẩm phát hiện ngoài phạm vi:** **Sales không có chỗ nào tự gõ Việc tiếp theo trên web** — `nextStepText` chỉ xuất hiện ở hai file hiển thị, form tạo cơ hội cũng không có ô. Ca I-7 chạy được vì **seed** đặt sẵn `next_step_source: 'human'`. Đề xuất P8 cân một ô sửa nhanh trên thẻ cơ hội.

### Phiên 8 — 14/08 00:44, P6 đóng

**225 test đơn vị (203 → +22) + 11 e2e (9 → +2) xanh**, lint/typecheck sạch, hai phép đo đột biến đều cắn. T-6 và T-7 đóng, cả ở tầng tích hợp lẫn trên trình duyệt thật.

Phase 6 là phase đầu **không** lệch với code thật — phiên 7 đã đọc lại repo trước khi viết. Đổi lại, ba thứ chỉ lộ ra lúc gõ code:

- **`ADR-0026` có một phản ví dụ không xảy ra được.** Nó mở đầu bằng "ô người gõ → máy đặt lần 1", mà **I-7 cấm đúng bước đó** ⇒ không đường nào của sản phẩm sinh event mang `previous_source = 'human'`; chuỗi thật luôn là `NULL → máy 1 → máy 2`. Quyết định **giữ nguyên** vì phương án D vẫn sai (trả về câu của máy, chỉ khác là giá trị đúng hoá ra là **rỗng**), nhưng nhánh `IS DISTINCT FROM NULL` từ chỗ "phòng xa" thành **nhánh duy nhất chạy thật**. ADR đã sửa mục verify. **Bài học:** một ADR verify bằng "dựng phản ví dụ trên chuỗi thật" mà chuỗi đó chưa từng chạy qua ràng buộc của phase khác thì phản ví dụ mới là giả thiết, không phải số đo.
- **`timestamptz` micro giây vs `Date` mili giây.** Bản đầu hỏi "có event nào mới hơn không" bằng cách gửi ngược `Date` vừa đọc xuống làm tham số ⇒ `created_at > $1` đúng với **chính hàng đó**, mọi lần Hoàn tác bị từ chối. Sửa: so `id` thay vì so thời gian, và dùng subquery cho mốc thời gian — **không giá trị thời gian nào rời khỏi CSDL rồi quay lại**. P7/P8 đụng `watch_cycle_runs.started_at` sẽ gặp lại nguyên hình dạng này.
- **Nối nhóm 4 vào làm đỏ 3 test của P5** — không phải hồi quy, mà là ba chỗ mã hoá giả định "nhóm 4 chưa tồn tại". Test 6 của P5 tự dựng `blockedNextSteps` bằng tay, và comment của chính nó đã ghi *"stands in for the I-7 hand-off feature group 4 will make"*; giờ chạy thật. Test 9 và e2e T-5 chọn thẻ không phân loại, nay Sakura có **hai** thẻ.

**Hai quyết định nhỏ chốt lúc code, đã ghi vào phase file:**

| Câu hỏi | Chốt | Vì sao |
| --- | --- | --- |
| Sau 7 ngày ô trông thế nào | Nút + đồng hồ biến mất, **dấu hiệu máy ở lại** | Luật 2 không hết hạn. Bỏ dấu hiệu = ô hoá thành ô người gõ sau đúng 7 ngày |
| Công ty không có người phụ trách | **Không tự ghi**, có `skippedReason` + log | Không có ai để báo thì mất một trong ba thứ mua quyền vùng 3. Hàng đợi vẫn nhận gợi ý |

**P8 mở khoá một nửa** (còn chờ P7). Ba thứ mang sang:

- **`pnpm build` trên máy Windows fail ở bước copy standalone của Next** (`EPERM: symlink`) — **có sẵn từ trước, không phải do P6**: đo bằng cách stash sạch cây rồi build lại, vẫn đúng 8 lỗi EPERM. Bản Linux trong container build xanh và toàn bộ e2e chạy trên nó. Đừng mất thời gian debug lại vào ngày cuối.
- **Sales vẫn chưa có chỗ tự gõ Việc tiếp theo trên web** (phát hiện phiên 7, vẫn còn). Giờ đáng giá hơn trước: sau khi Hoàn tác, ô về trống và không có đường nào điền lại bằng tay. **Đã nhận vào P8** — phạm vi tối thiểu, `PATCH /opportunities/:id` sẵn có, không endpoint mới.
- Bảng deal gọi **hai** endpoint và gộp ở client (ADR-0027 B1). Nếu P8 thấy nhấp nháy thì đó là chỗ đã ghi sẵn cách gộp lại.

### Phiên 9 — 14/08 02:35, phạm vi Phase 7

Phase 7 viết cùng lúc với plan (13/08 01:07) nên cùng hoàn cảnh đã làm P4/P5/P6 lệch. Kiểm bằng đọc mã nguồn ([báo cáo](../reports/from-brainstorm-to-planner-260814-0159-phase-07-nhom-5-vong-quet-ghi-dong-thoi-gian-report.md)): **hai chỗ lệch đủ nặng để đổi thiết kế, một bước là nợ đã trả rồi.**

**Nửa việc backend đã có sẵn:** `ObservationService.ingest()` đã làm trọn vòng đọc → so hash (I-3) → claim → `ClaimReactionService` (nhóm 4 rồi nhóm 3) ⇒ "nối vào đường ống nhóm 2" là một vòng `for` + một lời gọi. `watch_cycle_runs` đã có đủ 4 con số + `is_rollup` + `cycles_covered` ⇒ **0 migration** cho phần log. `timeline-section.tsx` đã có `machine-*` + `Badge tone="system"`. Worker đã có `ANTHROPIC_API_KEY` trong compose.

**Lỗ thứ nhất — lệch điều kiện I-4 ↔ I-5, ăn mất vật liệu của T-8.** I-5 chặn *Proposal* theo `is_watched`; I-4 chặn *system entry* theo `trigger_context`. Công ty đang theo dõi + người bấm `Đọc lại nguồn` ⇒ **không đường nào ghi**, và I-3 làm nó **vĩnh viễn** (vòng sau hash trùng → 0 claim). Không phải giả thiết: `e2e/t6-t7` bấm "Đọc bản chụp sau" trên **Nimbus, `isWatched: true`** ⇒ tin của Nimbus không bao giờ lên dòng thời gian và T-8 phụ thuộc thứ tự spec.

**Lỗ thứ hai — vùng 4 chỉ có một lớp chặn.** `0001_grants.sql:53` cấp `INSERT` **mức bảng** trên `timeline_entries` ⇒ `crm_system` ghi được `created_by='human'`, `source_claim_id=NULL`: **AI viết được một dòng trông như người gõ, không nguồn.** Đúng cấu trúc lỗi ADR-0015 đã bắt, đúng bảng mà ADR đó không phân loại (nó chỉ xét 7 bảng *mới* của P1).

**Một bước phải bỏ:** bước 8 bản cũ đòi trả nợ đột biến `@Cron`. Nợ đó **đã trả 12/08** trên stack thật (ADR-0011 mục verify, hai phép đo có log giờ). Thay bằng đột biến một dòng: `scheduleNextTick(60)` cứng → test 2 phải đỏ.

**Bốn quyết định chốt:**

| Câu hỏi | Chốt | Hệ quả lan ra |
| --- | --- | --- |
| Ai ghi tin khi công ty đang theo dõi mà người bấm đọc tay | **Điều kiện là `is_watched`, không phải `trigger_context`** — uỷ quyền là thuộc tính của công ty (ADR-0006), không của người bấm. **ADR-0028** | Sửa I-4 ở ontology mục 6 + bảng M-5. **Sửa 1 test đang xanh** (`reading-zone-provenance.test.ts:224` đọc Sakura — công ty đang theo dõi). Đường ghi bắt buộc nằm ở `ClaimReactionService` bước 3, không nằm trong worker |
| Lớp CSDL của vùng 4 | `GRANT INSERT` **theo cột** (bỏ `created_by`) + `DEFAULT 'system'` + CHECK nhãn hệ thống ⇒ có `source_claim_id`. **ADR-0029** | Migration `0007`. Đường ghi phải nêu đúng cột, **không** `db.insert().values()` (bẫy drizzle của P5); CHECK so `::text` (bẫy 55P04 của P5) |
| Dòng cộng dồn mỗi 10 vòng | **Làm** — một câu `INSERT … SELECT`, mốc lấy bằng subquery | `max(started_at)` để dòng cộng dồn nằm **sau** 10 dòng nó tổng kết. Không giá trị thời gian nào rời CSDL rồi quay lại (bẫy P6) |
| Màn Đang theo dõi + nav | **Màn `/dang-theo-doi` riêng** + công tắc một thao tác + dòng cảnh báo uỷ quyền. **Không sửa `layout.tsx`** | Nav thuộc chủ quyền [plan UI phase 2](../260814-0056-nang-cap-ui-shadcn-shell-tour/phase-02-app-shell-header-sidebar-footer.md) — P7 chỉ thêm hai `<Link>` tạm. Plan đó phải biết: nav thành **9 mục**, `git mv` phải có `dang-theo-doi` + `quan-tri` |

**Ước lượng 2h → 3h** (2 ADR, 1 migration, sửa 1 test cũ). Vòng quét từ nay **chạy cả nhóm 3 và nhóm 4** mỗi vòng — đúng Specs, nhưng nghĩa là 3 lần gọi LLM mỗi nhịp; với chu kỳ 10s của T-8 thì **tràn nhịp là chuyện thường**, đọc `skipped_reason` như trạng thái bình thường.

**Hợp đồng với P8:** `AuditEvent{ action:'delete_system_timeline_entry', detail:{ reason, sourceClaimId, description } }` là chỗ P8 đếm "số lần xoá mục hệ thống" cho tử số error-detection rate (ontology mục 7).

### Phiên 10 — 14/08 02:55, validate Phase 7

**Verification Results** — Claims checked: 18 · Verified: 15 · Failed: 1 · Đổi sang đường tốt hơn: 2 · Tier: Full (giới hạn Phase 7)

Khẳng định **sai**: phase file ghi `WatchModule` cần `NotificationService`. Không cần — `AutoNextStepService` tự `INSERT INTO notifications` trong transaction của chính nó (`auto-next-step-service.ts:249`) và chỉ nhận `dbSystem`, `dbApp`, `AuditEventService`. Danh sách provider của worker chốt lại **9 cái**, kiểm bằng đọc constructor từng service. Thiếu một là worker vỡ lúc boot, Docker restart, và log trông *gần đúng* — **đúng hình dạng lỗi `unref()` mà ADR-0011 kể**, nên tiêu chí nghiệm thu là dòng `Starting Nest application`, không phải số dòng `WatchCycleRun`.

**Một phát hiện ngoài danh sách claim, thuộc tài liệu:** [ADR-0011](../../docs/decisions/0011-worker-cung-image-va-vong-quet-tu-hen-nhip.md) mục Hệ quả viết *"Worker kết nối bằng `crm_system`, không có pool `crm_app`"*. Câu đó **sai từ trước P7**: `DbModule` là `@Global` và tạo cả hai pool vô điều kiện (`db.module.ts:20-36`), `SystemSettingService` — provider duy nhất của worker ngoài vòng quét — nhận cả hai (`:31-34`). P7 không gây ra, nhưng P7 làm nó quan trọng hơn vì từ nay service chọn-pool-theo-actor chạy trong worker. Đã kiểm phần đáng lo: **không đường ghi nào của vòng quét đi qua `crm_app`** — event + thông báo nằm trong transaction của `dbSystem` với `SYSTEM_ACTOR`, `dbApp` chỉ dùng ở `listActive()` là đường đọc của bảng deal.

**Bốn quyết định chốt:**

| Câu hỏi | Chốt | Hệ quả lan ra |
| --- | --- | --- |
| ADR-0011 nói sai về pool của worker | **Sửa một dòng ADR-0011** kèm câu chỉ ra đường ghi nào dùng pool nào | Phương án "chặn thật bằng cách bỏ `DATABASE_URL_APP` khỏi worker" bị loại: refactor `DbModule` theo `APP_ROLE` không rẻ trước freeze và có thể vỡ boot |
| `occurred_at` của mục hệ thống | **Truyền `capturedAt` vào `ClaimReactionInput`** — `ObservationService` đã có `created.capturedAt` từ `.returning()` ⇒ **0 truy vấn** | Rẻ hơn cả hai phương án đã nêu ở phiên brainstorm (truy vấn lại như `ProposalService`, hoặc `now()`). Mục mang mốc bản lưu nó sinh ra từ |
| Câu trích trên dòng thời gian | **Tra trong query `readingZone` đã cache** — `cong-ty/[id]/page.tsx:46` đã fetch observations kèm claims | `SourceViewer` cần cả object `observation` (`:28`), không chỉ `sourceClaimId`. **0 endpoint mới, 0 DTO đổi**, không đụng `toDto` của B trước freeze. Ca tra không ra → hiện nhãn + "không tra được bản lưu", không nút rỗng |
| Phạm vi đường xoá I-13 | **Chỉ mục `created_by='system'`**; mục người gõ → 403 | `stage_change` là vết đổi giai đoạn — xoá nó cần ADR riêng. Câu treo giao P8, ghi ở cuối phase file |

**Whole-Plan Consistency Sweep** — quét `plan.md` + 8 phase file + plan UI `260814-0056`. Bốn chỗ lệch phát hiện, cả bốn đã hoà giải: (1) dòng rủi ro *"`@Cron` trả trong P7"* → nợ đã trả 12/08; (2) khẳng định `[x]` I-4 của P2 → thêm ghi chú thu hẹp bởi ADR-0028, giữ nguyên bản ghi cũ vì nó đúng lúc P2 đóng; (3) P8 chưa biết đếm "số lần xoá mục hệ thống" ở đâu → chốt `audit_events.action = 'delete_system_timeline_entry'`; (4) plan UI đếm 7 route/7 mục nav → thành 8 mục · 7 thư mục `git mv` · 8 route cho command palette. **Không còn mâu thuẫn tồn đọng.**

### Phiên 11 — 14/08 03:38, P7 đóng

**262 test đơn vị (225 → +37) + 16 e2e (11 → +5) xanh**, lint/typecheck sạch, ba phép đo đột biến đều cắn. T-8 đóng trên stack thật với chu kỳ 10s và LLM thật. Hai ADR đã viết ([0028](../../docs/decisions/0028-quyen-ghi-muc-dong-thoi-gian-den-tu-nhan-dang-theo-doi-khong-tu-trigger-context.md) · [0029](../../docs/decisions/0029-grant-insert-theo-cot-tren-timeline-entries-va-check-nhan-he-thong.md)), ontology I-4 + I-5 + M-5b + M-13 đã sửa, dòng sai về pool của ADR-0011 đã sửa kèm số đo.

Bốn việc mang sang P8 — **ba trong số đó là bẫy sẽ gặp lại nguyên vẹn**:

- **Module khai báo controller có guard thì phải tự import `AuthModule`.** Dependency của guard giải trong module **khai báo controller**, không phải trong `AppModule` dù nó import cả hai. Thiếu → **sập cả container API**, triệu chứng là **502 ở trang đăng nhập**, và **toàn bộ test đơn vị vẫn xanh**. P8 thêm module có controller thì đọc lại dòng này trước. Đã có `watch-module-boots.test.ts` giải cả hai cây module — P8 thêm module mới thì thêm vào đó, lỗi sẽ đỏ trong 17ms.
- **`CHECK` không thay được `GRANT` theo cột, và ngược lại — đã đo.** Cấp lại INSERT mức bảng trên `timeline_entries` thì test "AI ghi `created_by='human'`" đỏ **trong khi `CHECK` vẫn xanh**. Hai lớp chặn hai ca khác nhau; đừng gộp.
- **Vòng quét giờ là tải nền của toàn bộ e2e.** Trước P7 `scan()` chỉ đếm công ty và không tạo gì; giờ nó đọc nguồn bằng LLM cho 3 công ty mỗi vòng. Hệ quả: mọi assertion chờ một lần đọc nguồn cần timeout thật (đã nâng lên 30s ở `reading-zone-provenance` và `t6-t7`; assertion không đổi), và **không spec nào được giả định vùng đọc của công ty đang theo dõi là rỗng lúc mở màn**. T-3 đã sửa sang khẳng định mạnh hơn: **đếm** số phát hiện = số nút xem nguồn.
- **`<dialog>` đóng vẫn ở trong DOM kèm nội dung.** Dialog mount vĩnh viễn làm mỗi mục dòng thời gian xuất hiện hai lần và `getByText` khớp 2 phần tử — T-1 đỏ trên một màn hình trông hoàn toàn đúng. Chỉ mount khi mở.

**Hợp đồng cho P8, đã có sẵn trong CSDL:** `audit_events.action = 'delete_system_timeline_entry'`, `detail` mang `reason` · `sourceClaimId` · `description` — đây là tử số "số lần xoá mục hệ thống" của error-detection rate (ontology mục 7). `GET /watch-cycle-runs` trả đủ 4 con số + `isRollup` + `cyclesCovered` cho bảng điều khiển.

**Một quyết định nhỏ chốt lúc code, lệch phase file có ý thức:** dòng cộng dồn gọi ở `tick()` chứ không ở cuối `scan()`. Phase file ghi `scan()`, nhưng nhịp bị bỏ **cũng tính là một vòng**, nên 10 vòng toàn skip sẽ không bao giờ được tổng kết — đúng đoạn nhật ký cần tổng kết nhất. Có test riêng (test 8 của `watch-cycle-scans-and-writes`).

### Phiên 12 — 14/08 10:12, phạm vi Phase 8

Phase 8 viết cùng lúc với plan (13/08 01:07) nên cùng hoàn cảnh đã làm P4/P5/P6/P7 lệch. Kiểm bằng đọc mã nguồn ([báo cáo](../reports/from-brainstorm-to-planner-260814-1012-phase-08-nhom-6-bang-dieu-khien-va-bo-nghiem-thu-report.md)): **ba chỗ lệch, cả ba đổi thiết kế.** Bù lại, hai chỗ nhẹ hơn tưởng.

**Hai tin tốt:** **P8 cần 0 migration** — `crm_app` có `GRANT ALL ON ALL TABLES` (`0001_grants.sql:23`) nên `setAiEnabled` chạy ngay, metrics và banner đều là đường đọc. **Lớp CSDL của T-10 đã chặn sẵn cả ba nhánh** — `:48` chỉ cấp `UPDATE` ba cột next-step, `:63` không cấp `DELETE` bảng nào ⇒ T-10 chỉ cần test chứng minh, không sửa quyền.

**Lỗ thứ nhất — T-9 hở: Sales không có đường nào biết AI đang tắt.** `GET /settings` là `@Roles('admin')` và `ai-status-pill.tsx:31` cố ý `enabled: isAdmin` ⇒ pill **không bao giờ render cho Sales**, đúng người dùng mà T-9 đòi phải thấy banner. Không phải giả thiết: comment trong chính file đã đẩy việc sang "banner ở màn sinh output AI" mà banner đó chưa tồn tại và chưa có nguồn dữ liệu.

**Lỗ thứ hai — mẫu số của error-detection rate chưa từng được định nghĩa.** Ontology mục 7 cho tử số rõ, mẫu số ghi "tổng output AI" — không đủ để viết một câu SQL, và hai cách đọc cho hai con số lệch nhau 5–10 lần.

**Lỗ thứ ba — Q-6 mô tả một thứ không tồn tại.** `company.controller.ts:29` · `opportunity.controller.ts:35` · `proposal.controller.ts:30` chỉ có `@UseGuards(JwtGuard)` ⇒ admin ghi y hệt Sales, ngược với câu "Admin xem tất cả, không sửa dữ liệu Sales" của phase file.

**Bốn quyết định chốt:**

| Câu hỏi | Chốt | Hệ quả lan ra |
| --- | --- | --- |
| Banner T-9 lấy trạng thái AI ở đâu | `GET /settings/ai-status` trả đúng `{aiEnabled}`, chỉ `JwtGuard` + banner **toàn cục** ở `(app)/layout.tsx`. **ADR-0032** | Giữ điểm nghiệm thu số 2 của skeleton (Sales 403 trên `/settings`). `RolesGuard:33` cho qua khi không có `@Roles` ⇒ route nằm trong controller cũ, **0 module mới, né bẫy `AuthModule` của P7** |
| Mẫu số error-detection rate | `proposals + auto_next_step_events + timeline_entries(created_by='system')` — tập mà người *có thể* bác. **ADR-0031** | Mọi tỉ lệ hiện **kèm mẫu số**; mẫu số 0 → "chưa có dữ liệu", không phải `0%`. Cộng `claims` bị loại: tỉ lệ gần 0 vĩnh viễn = số không bao giờ sai được |
| Q-6 | ADR một dòng nói đúng hiện trạng, **không** ép admin read-only. **ADR-0033** | Sửa chữ phase file + dòng Q-6 mục Câu hỏi chưa giải quyết. Ép read-only = 3 controller + guard mới + rủi ro e2e đỏ vào tối freeze, đổi lấy một dòng rubric không chấm |
| Nút đổi bản chụp trên Quản trị | **Có**, món cắt cuối cùng | Đóng câu treo "ai flip bản chụp lúc demo". ~20 dòng gọi endpoint đã có |

**Hai bẫy đã biết trước, ghi vào phase file:** `MetricsModule` là module mới **có controller** ⇒ phải tự `imports: [AuthModule]`, thiếu thì sập container API với triệu chứng 502 ở trang đăng nhập **trong khi test đơn vị vẫn xanh** (bài học P7) — thêm vào `watch-module-boots.test.ts` ngay lúc tạo. Trần dưới của `watch_cycle_seconds` **không được là 60**: T-8 e2e chạy 10s.

**T-9 an toàn với các spec khác:** `playwright.config.ts:20-22` là `workers: 1` + `fullyParallel: false` ⇒ tắt AI toàn cục không đụng spec đang chạy, miễn `afterAll` bật lại và trả chu kỳ về 60 — đúng khuôn T-1 đã làm.

**Ước lượng 4h → 4h30**, nhưng chia được ba nhánh song song (**A 2h · B 1.5h · C 2h**, C bị chặn 30' đầu chờ endpoint của A) ⇒ **~2.5h thực tế**. Ba ADR phải viết: 0031 · 0032 · 0033.

### Phiên 13 — 14/08 11:30, P8 đóng, plan đóng

**281 test đơn vị (262 → +19) + 32 e2e (31 → +1) xanh bằng một lệnh**, lint/typecheck sạch, hai phép đo đột biến đều cắn. **10/10 điểm nghiệm thu của Specs mục 6.** Không cắt món nào trong danh sách cắt của P8 — nút đổi bản chụp và ô sửa nhanh Việc tiếp theo đều làm.

Bốn việc đáng mang đi, **ba trong số đó là bẫy locator sẽ gặp lại**:

- **Vai trò ARIA cũng va nhau, không chỉ chuỗi ký tự.** Banner "AI đang tắt" mang `role="status"`; T-1 chạy với AI **đang tắt** nên `getByRole('status')` của nó khớp 2 phần tử (vùng live dnd-kit + banner) và T-1 đỏ trên một màn hình đúng hoàn toàn. Cùng họ với bẫy `getByText` khớp chuỗi con của P4, nhưng ở tầng vai trò — nghĩa là **thêm một phần tử toàn cục có thể làm đỏ một spec không liên quan gì tới nó**. Locator phải trỏ vào thứ mình định trỏ (`[id^="DndLiveRegion"]`), không phải vào loại của nó.
- **`Duyệt` là tiền tố của `Sửa rồi duyệt`** — đúng bẫy P4 đã ghi thành chữ, gặp lại nguyên hình dạng, vẫn tốn một lượt chạy. Ghi được vào plan **không** bằng chặn được.
- **Thêm một dependency vào service dùng chung = sửa 7 file test.** `SystemSettingService` cần `AuditEventService` để ghi vết bật/tắt, và nó được `new` bằng tay ở 7 test tích hợp. Chi phí ẩn của câu "chỉ thêm một tham số constructor".
- **Restart Postgres làm worker restart theo** (đo được: `RestartCount=1`, dòng `Starting Nest application` ngay sau). Vô hại — nhưng khi đọc nhật ký vòng quét sau một lần restart stack, một nhịp lệch không phải là lỗi nhịp.

**Một chỗ lệch phase file có ý thức:** nút đổi bản chụp chỉ hiện trạng thái của công ty **đã bấm trong phiên này**, vì `CompanyDto` cố ý không mang `snapshot_variant` (ADR-0022, và `DemoSnapshotService` ghi rõ lý do). Nới DTO để hiện một nhãn trên một màn quản trị là đẩy ống nước của demo lên mọi màn đọc công ty.

**Tài liệu đã sửa cùng phiên:** [ontology mục 7](../../docs/ontology.md#7-chỉ-số-đo-từ-ngày-đầu) — mẫu số error-detection rate từ "tổng output AI" (không viết được thành SQL) thành ba tập tường minh, kèm hai luật hiển thị. ADR-0031 và ADR-0032 đã trả phần *nợ đo*, mỗi cái kèm tên test và kết quả phép đo đột biến.

## Câu hỏi chưa giải quyết

- ~~**Q-6: Admin có được thao tác CRM không**~~ — **chốt 14/08 10:12**: vòng 1 Admin có quyền CRM **y hệt Sales** (ba controller chỉ có `JwtGuard`), ma trận quyền chi tiết ngoài phạm vi. Câu "Admin xem tất cả, không sửa dữ liệu Sales" trong bản cũ **mô tả một thứ không tồn tại trong code** — đã bỏ. Ghi thành ADR-0033 thay vì ép read-only vào tối freeze.
- Format bộ dữ liệu BTC — [ADR-0013](../../docs/decisions/0013-seed-theo-du-lieu-tu-dat-chap-nhan-migrate-khi-btc-giao-du-lieu.md) đã quyết không chờ. Khi dữ liệu về thì thay `seed-data.ts`.
- ~~**Công ty #5 `it_product` của P4**~~ — **đã làm**, không phải cắt. Marlin Product Labs dùng chung hằng số đoạn funding với Sakura.
- ~~**Ai flip bản chụp lúc demo**~~ — **chốt 14/08 10:12: có nút trong màn Quản trị**, ~20 dòng gọi `POST /api/demo/companies/:id/snapshot-variant` đã có, để lúc demo không phải rời trình duyệt sang terminal. Xếp **cuối danh sách cắt** của P8.
- ~~**Sales không có chỗ nào tự gõ Việc tiếp theo trên web**~~ — **đã giao cho P8 lúc 14/08 00:48**, không còn là câu treo. Chi tiết + phạm vi tối thiểu ở [mục "Lỗ P6 để lại"](phase-08-nhom-6-bang-dieu-khien-va-bo-nghiem-thu.md#lỗ-p6-để-lại--ô-sửa-nhanh-việc-tiếp-theo). Dùng `PATCH /opportunities/:id` sẵn có, ~30', **cắt cuối cùng** — và cắt thì phải nói thẳng với BGK.
- **Xoá mục dòng thời gian do người gõ** — Specs viết "xoá mục hệ thống *như mọi mục khác*" nhưng không có đường nào và I-13 chỉ ràng buộc mục hệ thống. P7 chốt phạm vi hẹp; [câu treo giao P8](phase-07-nhom-5-vong-quet-ghi-dong-thoi-gian.md#câu-treo-giao-cho-p8). Không chặn gì.
- Telemetry của thành viên 2 và 3 chưa verify trên Grafana (README mục Telemetry). **Không phải việc của plan này nhưng là điều kiện qua vòng 1** — mỗi người tự kiểm trước khi gõ dòng đầu.
