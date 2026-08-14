# Trạng thái dự án 14/08 12:45 — code đóng, việc còn lại là nộp bài

| | |
| --- | --- |
| **Nhánh** | `feat/phase-8` — **đã merge vào `origin/master`** (PR #11, 14/08 12:43). Không commit nào treo. `master` local cũ, vô hại |
| **Test** | 281 đơn vị + 32 e2e xanh bằng một lệnh `pnpm test` |
| **Nghiệm thu** | **10/10** điểm Specs mục 6 (T-1…T-10) |
| **ADR** | 35 |
| **Mốc** | feature freeze **tối nay 14/08** · nộp vòng 1 **15/08 15:00** |

## Plan — cả hai đóng

| Plan | Trạng thái | Ghi chú |
| --- | --- | --- |
| `260812-1912-base-project-walking-skeleton` | done | 6/6 điểm nghiệm thu |
| `260813-0107-feature-groups-1-6-and-acceptance-suite` | **done** | 8/8 phase, 10/10 điểm, đóng 14/08 11:30 |
| `260814-0056-nang-cap-ui-shadcn-shell-tour` | **done** | 6/6 phase, ADR-0030 |

Không phase nào hở. Không có việc code nào đang dở.

## Ba việc còn lại — đều ngoài code

### 1. Tài liệu trình bày & Demo — **chưa tồn tại**, bắt buộc

Thể lệ: 2 hạng mục nộp bắt buộc = **source code** + **tài liệu trình bày & demo**. `docs/` hiện không có file nào thuộc loại này.

Yêu cầu nội dung: *giải pháp + quá trình thực hiện + demo*, và **phải nêu rõ AI được ứng dụng thế nào** — công đoạn nào, mức độ tham gia, giá trị mang lại. Format tự do (Markdown / HTML / PPT đều được).

Vật liệu có sẵn, gần như chỉ việc gom: 35 ADR (kèm phương án bị loại) · 13 phiên phản biện trong Validation Log · 16 report ở `plans/reports/` · bảng trần tự chủ 4 vùng · 10 điểm nghiệm thu.

**Món tốn thời gian nhất và chưa bắt đầu.**

### 2. Telemetry thành viên 2 & 3 — **cửa loại vòng 1**

README mục Telemetry: HungLV ✅, hai người còn lại `❓`. Luật: **không có log Claude Code trên Grafana = 0 điểm = không qua vòng 1**, bất kể sản phẩm.

Verify đúng cách = **thấy metric `claude_code.session.count` của chính mình trên dashboard**. `claude --debug | grep -i otel` không lỗi thì *chưa* tính là xong.

Mỗi người 5 phút. Rẻ nhất, rủi ro cao nhất, nên làm trước.

### 3. Kịch bản demo + tập chạy — vòng 2

10' present + 5' Q&A, **BGK hỏi random 3–5 câu dựa trên log**. Luật 7 của đội đòi ai cũng bảo vệ được mọi output AI.

Đường demo đề xuất, bám đúng bốn vùng tự chủ: đăng nhập → CRM tay (kéo giai đoạn) → `switch-snapshot after` → provenance bấm ra nguồn → hàng đợi duyệt → tự đặt Việc tiếp theo + Hoàn tác → tắt AI (banner Sales) → bảng điều khiển chỉ số. Bấm giờ thật, cắt cho vừa 10'.

## Ba việc phụ — rẻ, sau khi 1–3 xong

| Việc | Vì sao đáng làm |
| --- | --- |
| Backfill `docs/ai-sessions/` | Chỉ có **1** prompt log trong khi plan ghi **13** phiên phản biện. Là bằng chứng minh bạch (bonus) **và là đề thi vòng 2**. Gom từ `plans/reports/` |
| Chạy thử từ clone trắng | `pnpm reset && pnpm start && pnpm seed` + login. Giám khảo sẽ làm đúng việc này; chưa có lần chạy từ máy sạch nào được ghi nhận |
| `.gitignore` thêm `test-results/` | `.last-run.json` đang bị track. Đã ghi là việc **sau** freeze vì nó untrack một file đang commit |

## Thứ tự đề xuất

1. **Ngay** — mỗi người verify telemetry trên Grafana (cửa loại, 5'/người)
2. **Chiều/tối 14/08** — viết tài liệu trình bày & demo
3. **Sáng 15/08** — tập demo bấm giờ + ôn ADR cho Q&A, rồi ba việc phụ

## Câu treo — không chặn gì, nói thẳng nếu BGK hỏi

- **Xoá mục dòng thời gian do người gõ**: Specs viết "xoá mục hệ thống *như mọi mục khác*" nhưng I-13 chỉ ràng buộc mục hệ thống, `stage_change` là vết đổi giai đoạn nên xoá cần ADR riêng. Ngoài phạm vi vòng 1.
- **Format bộ dữ liệu BTC**: ADR-0013 đã quyết không chờ; dữ liệu về thì thay `seed-data.ts` + `demo-snapshots.ts`.
- **Mốc BTC bắt đầu thu log**: thể lệ cho build 12–14/08 nhưng loại trừ việc làm trước mốc thu log. Chưa hỏi BTC — nếu mốc muộn hơn 12/08 thì phần đầu dự án không được tính điểm vòng 1.
