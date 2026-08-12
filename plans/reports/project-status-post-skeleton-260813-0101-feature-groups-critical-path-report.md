# Trạng thái dự án 13/08 01:00 — làm gì tiếp

> Nguồn: `plans/260812-1912-base-project-walking-skeleton/plan.md` (status done) · `plans/reports/walking-skeleton-acceptance-260812-2210-*.md` · `git log` · inventory `packages/db/src/schema`, `apps/api/src`, `apps/web/src` · `docs/hackathon-spec-ai-native-crm.md` mục 4 & 6.
> Còn lại tới feature freeze **tối 14/08**: ~2 ngày làm việc. Vòng 1 chốt 15/08 15:00.

## 1. Đã xong

| Hạng mục | Bằng chứng |
| --- | --- |
| Walking skeleton, 6/6 điểm nghiệm thu trên stack thật | plan status `done`, báo cáo nghiệm thu 12/08 22:10 |
| 55 test xanh bằng 1 lệnh (contracts 22 · db 11 · api 19 · e2e 3) | báo cáo nghiệm thu điểm 5 |
| Ontology → code: lớp 1 (16 enum ở contracts) + lớp 2 (7 bảng) + lớp 4 (GRANT theo cột) | `packages/contracts/src/enums.ts`, `migrations/0001_grants.sql` |
| Nợ "chưa commit" đã trả | `git ls-files apps packages infra` → 87 file tracked |
| 12 ADR, 1 prompt log | `docs/decisions/`, `docs/ai-sessions/` |

## 2. Khoảng cách thật so với đề bài

**Bảng: có 7 / cần 14.** Thiếu đúng 7 bảng, tất cả thuộc vùng AI:
`contacts` · `observations` · `claims` · `proposals` · `proposal_decisions` · `auto_next_step_events` · `notifications`

**Nhóm tính năng: 6 nhóm, chưa nhóm nào xong.**

| Nhóm | Có gì rồi | Thiếu |
| --- | --- | --- |
| 1 · CRM làm tay | Company create/list, `updateStage`, `updateNextStep` (service) | Contact, cơ hội đầy đủ, kéo thả 7 giai đoạn, chốt Đủ điều kiện 2 ô dấu hiệu, lý do thua, dòng thời gian, tìm/lọc, màn tổng quan |
| 2 · Đọc nguồn & rút phát hiện | ADR-0002/0003/0012 đã chốt; `quote-block.tsx` (vỏ) | Toàn bộ: ingest bản chụp, Observation, Claim + offset, khu vùng đọc, mở đúng đoạn có đánh dấu |
| 3 · Hàng đợi gợi ý | — | Toàn bộ (Proposal + 3 nút + ProposalDecision + metric) |
| 4 · Tự đặt Việc tiếp theo | `updateNextStep` có chọn pool theo actor | AutoNextStepEvent, Notification, Hoàn tác 7 ngày, dấu hiệu `system` |
| 5 · Vòng quét | Worker tự hẹn nhịp **đã verify chạy thật** (ADR-0011) | Nhãn Đang theo dõi, vòng đọc-so-ghi, tự thêm TimelineEntry, Nhật ký + rollup 10 vòng |
| 6 · Bảng điều khiển Admin | `system_settings` (ai_enabled, watch_cycle_seconds) + RolesGuard | Màn số liệu, nút tắt AI ở UI, banner Sales thấy AI đang tắt, ghi vết bật/tắt |

**Bộ nghiệm thu 10 điểm (yêu cầu nộp bài mục 4): có 1/10** — chỉ T-10 mini (đổi `stage`). Thiếu T-1…T-9 và 2 nhánh còn lại của T-10 (sửa giá trị tiền, xoá công ty).

## 3. Hai việc không phải code, đang là rủi ro cao nhất

| Việc | Vì sao gấp |
| --- | --- |
| **Verify log Claude Code lên Grafana** | README ghi rõ: không có log = **0 điểm, không qua vòng 1**. Máy HungLV có đủ 6 biến OTEL nhưng **chưa thấy data** (thiếu URL + tài khoản). Thành viên 2, 3 chưa biết trạng thái. Đây là pass/fail, không phải điểm cộng |
| **Hỏi BTC format bộ dữ liệu** | Nộp bài mục 5 đòi nạp dữ liệu BTC bằng 1 lệnh, chạy lại về trạng thái đầu. Chưa biết format → seed hiện tại có thể phải viết lại. Hỏi càng sớm càng đỡ |

Q-3 (bản chụp HTML hay text) **không còn chặn nữa** — ADR-0012 đã tự quyết: giữ `raw_html` nguyên bản, offset và `content_hash` tính trên `raw_content`. Nhóm 2 đi được ngay.

## 4. Đường găng đề nghị

Phụ thuộc cứng: nhóm 2 sinh `Claim` → nhóm 3, 4, 5 đều tiêu thụ `Claim`. Nhóm 6 chỉ đọc số của 2/3/4/5 → làm sau cùng, rẻ. Nhóm 1 độc lập hoàn toàn nhưng là **bề mặt UI lớn nhất** và là điều kiện của T-1.

```
[seam: 7 bảng + type contracts]  ← 45', 1 người, cả đội chờ
        ├── A: nhóm 2 (Observation → Claim + provenance)
        │        └── 14/08: nhóm 3 · nhóm 4 · nhóm 5
        ├── B: nhóm 1 CRM (kanban, contact, timeline, tổng quan)
        └── C: seed fixture bản chụp "trước/sau" + T-1 test
                                       └── 14/08 chiều: nhóm 6 + đóng T-1..T-10
```

Đề nghị mốc:
- **13/08 sáng:** seam (7 bảng + GRANT theo cột cho cả 7 bảng + type ở contracts). Không ai code nhóm nào trước khi seam xanh.
- **13/08:** nhóm 2 và nhóm 1 chạy song song. Fixture bản chụp trước/sau xong trong ngày — **T-6 và T-8 không test được nếu không có bản "sau"**.
- **14/08 sáng:** nhóm 3, 4, 5 song song (mỗi nhóm 1 người, không đụng file).
- **14/08 chiều:** nhóm 6 + đóng nốt T-1…T-10. Freeze tối.
- **15/08:** hardening, kịch bản demo 10', prompt log, review ADR.

## 5. Bốn luật phải áp ngay, rút từ hai lỗi hôm qua

1. **GRANT theo cột phải mở rộng cho cả 7 bảng mới trong cùng migration.** Bỏ qua = ADR-0004 chỉ còn một lớp trên đúng những đường ghi nguy hiểm nhất (nhóm 4, 5). Đây chính là lỗi (a) hôm qua, lặp lại ở quy mô lớn hơn.
2. **Hàm nào nhận `actor` thì chọn pool theo `actor`** — không ghi cứng `dbApp`. Chọn pool là cơ chế chặn, không phải chi tiết hiện thực.
3. **Mỗi đường ghi mới chạy lại phép đo đột biến** (xoá dòng kiểm → test phải đỏ). Không suy diễn từ đường ghi cũ.
4. **Test T-x viết cùng nhóm, không dồn sang 15/08.** Bộ 10 điểm là hạng mục nộp bài; dồn lại thì ngày hardening thành ngày build.

Thêm: **câu trích do LLM sinh phải kiểm là chuỗi con nguyên văn của `raw_content` bằng code** (ADR-0002, I-2). LLM hay diễn giải lại; không khớp thì bỏ claim, không "sửa cho gần giống" — luật 4 của CLAUDE.md (thà trống hơn sai).

## 6. Việc nhỏ nên làm trước khi mở phase mới (~20')

- Commit 4 file đang dirty (ADR-0012 + `docs/ontology.md` + `docs/decisions/README.md` + visual HTML).
- `phase-01`…`phase-04` còn checkbox `[ ]` dù status `done` (5 mục mỗi file) → sync-back cho khỏi lệch trạng thái.
- `docs/ontology.md` vẫn ⬜ "chưa có người ngoài người viết đọc lại" — DoD của đội đòi điều này, và rubric thưởng nó. Cần 1 người thứ hai đọc, 15'.

## Câu hỏi chưa giải quyết

1. **Đội có mấy người làm 13–14/08?** README ghi thành viên 2 và 3 chưa rõ cả trạng thái telemetry. Chia việc mục 4 giả định 3 người; nếu chỉ 1 người thì phải cắt phạm vi (đề nghị cắt: kéo thả → dropdown giai đoạn; màn tổng quan → 3 con số; nhóm 6 → 1 trang số liệu thô), không cắt T-1…T-10.
2. **LLM thật hay bộ trích xuất tất định cho nhóm 2?** Hiện chỉ có adapter đọc fixture. Đề xuất: LLM đề xuất câu trích, code kiểm chuỗi con — nhưng cần chốt thành ADR trước khi ai code nhóm 2.
3. Format bộ dữ liệu BTC (mục 3 báo cáo này) — chờ BTC.
4. Q-6 Admin có được thao tác CRM không — vẫn treo, chặn ma trận quyền của nhóm 6.
