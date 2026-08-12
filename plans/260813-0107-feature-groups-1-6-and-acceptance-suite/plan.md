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

## Mục tiêu

Sáu nhóm tính năng của Specs mục 4 chạy được trên stack production, và **bộ nghiệm thu 10 điểm** của Specs mục 6 chạy bằng một lệnh. Hiện có 1/10 (T-10 mini).

**Feature freeze tối 14/08.** 15/08 chỉ hardening + demo, vòng 1 chốt 15:00.

## Ngân sách — nói thẳng chỗ không vừa

3 người × 2 ngày. Cộng ước lượng: **~25h việc / ~24h năng lực**. Không có đệm.

Đường găng: **P1 (1h) → P2 nhóm 2 (3h) → P6 nhóm 4 (3h) → P8 nghiệm thu (4h) = 11h**, phần lớn trên vai A. Vừa đúng 2 ngày nếu không hỏng gì — nghĩa là hỏng một chỗ là trượt freeze.

Cắt theo đúng thứ tự này nếu tới **trưa 14/08** mà P4/P5 chưa xong:

1. Kéo thả giai đoạn → dropdown (nhóm 1). Specs đòi kéo thả, nhưng T-1 chỉ đòi kéo được qua ba giai đoạn — mất điểm sản phẩm, không mất điểm nghiệm thu.
2. Dòng tổng hợp cộng dồn mỗi 10 vòng (nhóm 5).
3. Màn tổng quan còn 3 con số (nhóm 1).
4. Nhóm 6 gộp còn một trang số liệu thô, không biểu đồ.

**Không cắt, kể cả trượt:** T-1…T-10 · provenance bấm ra được nguồn · hàng đợi duyệt · Hoàn tác 7 ngày · nút tắt AI. Đây là những chỗ rubric chấm hành vi.

## Phases

| # | Phase | Trạng thái | Người | Ước lượng | Phụ thuộc |
| --- | --- | --- | --- | --- | --- |
| 1 | [Seam — 7 bảng còn lại, GRANT, contracts](phase-01-seam-bay-bang-con-lai-grant-va-contracts.md) | pending | 1 người, **cả đội chờ** | 60' | — |
| 2 | [Nhóm 2 — bản lưu + phát hiện + provenance](phase-02-nhom-2-ban-luu-phat-hien-provenance.md) | pending | A | 3h | 1 |
| 3 | [Nhóm 1 — CRM làm tay](phase-03-nhom-1-crm-lam-tay.md) | pending | B | 5h | 1 |
| 4 | [Seed bản chụp trước/sau + T-1](phase-04-seed-ban-chup-truoc-sau-va-t1.md) | pending | C | 2h | 1, (3 cho T-1) |
| 5 | [Nhóm 3 — hàng đợi gợi ý](phase-05-nhom-3-hang-doi-goi-y.md) | pending | B | 3h | 2 |
| 6 | [Nhóm 4 — tự đặt Việc tiếp theo + Hoàn tác](phase-06-nhom-4-tu-dat-viec-tiep-theo.md) | pending | A | 3h | 2 |
| 7 | [Nhóm 5 — vòng quét ghi dòng thời gian](phase-07-nhom-5-vong-quet-ghi-dong-thoi-gian.md) | pending | C | 2h | 2, 4 |
| 8 | [Nhóm 6 — bảng điều khiển + đóng T-1…T-10](phase-08-nhom-6-bang-dieu-khien-va-bo-nghiem-thu.md) | pending | cả đội | 4h | 5, 6, 7 |

```
P1 (cả đội chờ, 60')
 ├── A: P2 nhóm 2 ──────────┬── P6 nhóm 4 ──┐
 ├── B: P3 nhóm 1 ──────────┴── P5 nhóm 3 ──┼── P8 nhóm 6 + T-1..T-10
 └── C: P4 seed fixture ─────── P7 nhóm 5 ──┘
```

Phụ thuộc cứng duy nhất: **P5, P6, P7 đều cần `Claim` của P2**. P3 và P4 không cần.

### Mốc thời gian

| Khi | Phải xong |
| --- | --- |
| 13/08 sáng | P1. **Không ai code nhóm nào trước khi P1 xanh** |
| 13/08 hết ngày | P2, P3, P4 |
| 14/08 trưa | P5, P6, P7. Chưa xong → cắt theo danh sách trên |
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
| T-2 | Phát hiện thiếu câu trích không lưu được — thử ghi thẳng, phải bị từ chối | 2 |
| T-3 | Bấm phát hiện → mở đúng đoạn gốc, có đánh dấu | 2 |
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
| LLM trả câu trích diễn giải thay vì nguyên văn → claim bị bỏ hàng loạt | P2 đo tỉ lệ khớp **trước** khi P5/P6 bắt đầu. Sửa prompt, **không** hạ chuẩn kiểm chuỗi con |
| Quên GRANT cho bảng mới → nhóm 4/5 ghi không được | P1 test cả hai chiều cho từng bảng mới, giống `column-grants-block-system-actor.test.ts` đã làm |
| Nhóm 1 phình ra ăn hết ngày 13 | Cắt kéo thả trước, cắt màn tổng quan sau. Ranh giới cắt ghi ở mục Ngân sách |
| Vòng quét gọi LLM chậm hơn nhịp 60s | Đã có luật bỏ nhịp + `skipped_reason` của ADR-0011. P7 test đúng kịch bản này |
| Ba phép đo đột biến còn nợ từ plan skeleton | P1 trả nợ GRANT + enum; `@Cron` trả trong P7 |

## Câu hỏi chưa giải quyết

- **Q-6: Admin có được thao tác CRM không** — chặn ma trận quyền của nhóm 6. P8 tạm làm: Admin xem được tất cả, không sửa dữ liệu Sales.
- Format bộ dữ liệu BTC — [ADR-0013](../../docs/decisions/0013-seed-theo-du-lieu-tu-dat-chap-nhan-migrate-khi-btc-giao-du-lieu.md) đã quyết không chờ. Khi dữ liệu về thì thay `seed-data.ts`.
- Telemetry của thành viên 2 và 3 chưa verify trên Grafana (README mục Telemetry). **Không phải việc của plan này nhưng là điều kiện qua vòng 1** — mỗi người tự kiểm trước khi gõ dòng đầu.
