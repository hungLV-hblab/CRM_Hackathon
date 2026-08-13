# ADR-0028 — Quyền tự ghi mục dòng thời gian đến từ nhãn **Đang theo dõi** của công ty, không từ `trigger_context` của lần đọc

| | |
| --- | --- |
| **Ngày** | 2026-08-14 02:35 |
| **Giai đoạn** | Design (phase 7 — nhóm 5, vùng tự chủ 4) |
| **Trạng thái** | Chấp nhận — **đã verify bằng test hai chiều 14/08 02:39** |
| **Người quyết định** | HungLV |
| **Prompt log** | phiên phản biện phase 7 ngày 14/08 01:59 — [báo cáo](../../plans/reports/from-brainstorm-to-planner-260814-0159-phase-07-nhom-5-vong-quet-ghi-dong-thoi-gian-report.md) |

## Bối cảnh

Hai bất biến của sản phẩm nói về **cùng một tin** nhưng lấy điều kiện ở **hai chỗ khác nhau**:

| Bất biến | Chặn cái gì | Điều kiện đọc ở đâu |
| --- | --- | --- |
| **I-5** ([ADR-0006](0006-bat-dang-theo-doi-la-uy-quyen-phan-ghi-tin.md)) | `Proposal` loại `timeline_entry` | `companies.is_watched` |
| **I-4** (bản cũ, ontology mục 6) | `TimelineEntry` do hệ thống thêm | `claims.trigger_context = 'watch_cycle'` |

Ghép hai điều kiện lên một bảng bốn ô thì lộ ra một ô trống:

| | người bấm `Đọc lại nguồn` | vòng quét đọc |
| --- | --- | --- |
| **Đang theo dõi** | I-5 chặn gợi ý (vì `is_watched`) · I-4 chặn mục hệ thống (vì `manual_ingest`) ⇒ **không đường nào ghi** | mục hệ thống |
| **Không theo dõi** | gợi ý | I-5 cho gợi ý · I-4 cho mục ⇒ **hai đường cùng chạy** |

Ô trên-trái là mất tin, ô dưới-phải là ghi hai lần. Và ô trên-trái **không tự khỏi ở vòng sau**: I-3 ([ADR-0003](0003-chi-tao-ban-luu-khi-noi-dung-thay-doi.md)) so hash với bản lưu gần nhất, nên vòng quét kế tiếp thấy hash trùng, không tạo bản lưu, không sinh phát hiện nào. **Tin đó biến mất vĩnh viễn.**

Không phải giả thiết. `e2e/t6-t7-auto-next-step-and-undo.spec.ts` bấm "Đọc bản chụp sau" trên **Nimbus**, mà Nimbus có `isWatched: true` trong seed. Nghĩa là ở trạng thái trước ADR này: tin bổ nhiệm CTO của Nimbus không bao giờ lên được dòng thời gian, và **T-8 phụ thuộc vào thứ tự chạy của các spec** — chạy T-6 trước thì T-8 mất một trong ba công ty có nội dung mới.

## Phương án đã cân nhắc

Tiêu chí: *(1)* bịt được cả hai ô sai · *(2)* khớp với nghĩa nghiệp vụ của nhãn Đang theo dõi · *(3)* số test đang xanh phải sửa · *(4)* rủi ro với T-6/T-7 đang đóng · *(5)* giải thích được trong một câu ở vòng 2.

| Phương án | Ưu | Nhược | Kết luận |
| --- | --- | --- | --- |
| **A.** Điều kiện của **cả hai** đường là `is_watched`; `trigger_context` không còn quyết định gì về quyền ghi | Bảng bốn ô kín, mỗi ô đúng **một** đường. Khớp ADR-0006: uỷ quyền là thuộc tính của **công ty**, người bấm chỉ là người bấm. Một câu giải thích: *"bật Đang theo dõi là uỷ quyền ghi tin, ai đọc cũng vậy"*. `trigger_context` vẫn được lưu — nó là dữ kiện về lần đọc, chỉ không còn là quyền | Phải sửa **1 test đang xanh** (`reading-zone-provenance` test 8, đọc Sakura — công ty đang theo dõi) và sửa I-4 ở ontology mục 6 | ✅ **Chọn** |
| **B.** Điều kiện của cả hai đường là `trigger_context = 'watch_cycle'` | Không sửa ontology I-4. Đúng nghĩa hẹp "chỉ vòng quét mới tự ghi" | Bịt ô trên-trái bằng cách **bỏ luôn tin** — người bấm đọc trên công ty đang theo dõi thì không có gợi ý (I-5 vẫn chặn) và không có mục. Vẫn mất tin, chỉ khác là mất có chủ ý. Và mâu thuẫn ADR-0006: uỷ quyền hoá ra phụ thuộc ai bấm chuột | ❌ Loại — không bịt được ô trên-trái, chỉ hợp thức hoá nó |
| **C.** Chặn hẳn nút `Đọc lại nguồn` trên công ty đang theo dõi | Ô trên-trái không tồn tại nữa vì không vào được | **Làm đỏ T-6 và T-7**, hai điểm nghiệm thu đã đóng: cả hai lái bằng cách bấm "Đọc bản chụp sau" trên Nimbus, `isWatched: true`. Đổi cờ trong seed để tránh thì đổi luôn số thẻ hàng đợi mà P5 đã đo và ghi vào báo cáo. Và về sản phẩm: cấm Sales đọc lại nguồn công ty họ quan tâm nhất là vô lý | ❌ Loại — phá hai điểm nghiệm thu đang xanh để sửa một điểm chưa làm |
| **D.** Cho phép cả hai đường ở ô dưới-phải, thêm cơ chế chống trùng khi duyệt gợi ý | Không phải chọn giữa hai đường | I-5 tồn tại **chính vì** không muốn chọn lúc duyệt. Hai thẻ cùng nội dung cho người duyệt không có gì để chọn, và P5 đã đo đúng lỗi đó trên bộ demo (Kitefin ra hai thẻ website y hệt) | ❌ Loại — quay lại lỗi P5 vừa sửa |
| **E.** "Quét bù": vòng quét tìm phát hiện cũ chưa có mục nào rồi ghi bù | Bịt ô trên-trái mà không sửa I-4 | Cần **tombstone**: mục Sales đã xoá theo I-13 sẽ mọc lại vòng sau, nên phải lưu "đã từng có mục và bị xoá" cho mọi phát hiện. Xoá-rồi-mọc-lại phá đúng thứ mua quyền cho vùng 4 | ❌ Loại — thêm một bảng trạng thái để sửa một điều kiện sai một chỗ |

## Quyết định

Chọn **A**. Điều kiện của bước nhóm 5 là `companies.is_watched`, và `trigger_context` không tham gia quyết định quyền ghi nữa.

Kéo theo **chỗ đặt code**: bước nhóm 5 **không** nằm trong `WatchCycleService`. Đường đọc tay cũng phải ghi được, và đường đó không đi qua worker. Nó nằm ở `ClaimReactionService` bước 3 — chỗ hai đường đọc đã gặp nhau ([ADR-0023](0023-goi-y-viec-tiep-theo-la-proposal-type-thu-ba-kem-cot-opportunity-id.md)).

Bộ lọc của bước nhóm 5 là **bản copy nguyên văn** ba điều kiện của `ProposalService.buildTimelineEntry` (`confidence ∈ {certain, likely}` · `signalType ≠ 'other'` · `is_watched`). Copy có ý thức, không phải trùng lặp bỏ sót: hai nhánh là **gương** của nhau, và viết cạnh nhau là cách duy nhất để một test chứng minh chúng chia đôi tập phát hiện không chồng, không hở. Rút ra hàm dùng chung sẽ làm một thay đổi lệch một bên **biên dịch được mà không ai thấy**.

## Verify

Bảng bốn ô là test, không phải lời kể — `apps/api/src/watch/__tests__/system-timeline-entry-writes.test.ts` test 1–4. **Mỗi ô khẳng định cả hai nửa** (có mục / không có gợi ý, và ngược lại): chỉ khẳng định một nửa thì bản cài đặt vừa ghi mục vừa xếp gợi ý sẽ lọt.

Phép đo đột biến, chạy 14/08 02:42: bỏ điều kiện `is_watched` ở bước nhóm 5 → test 3 và test 4 **đỏ**, khôi phục → xanh. Đây là phép đo thứ ba của phase 7.

Kèm theo, **một test đang xanh đã đổi nghĩa có ý thức** — `reading-zone-provenance.test.ts` test 8 đọc Sakura, công ty đang theo dõi, nên bây giờ khẳng định **có** một mục hệ thống mang nhãn + câu trích; ca "không uỷ quyền ⇒ 0 mục" chuyển sang test 8b trên **Marlin** (`is_watched = false`). Việc sửa test này là bằng chứng ngữ nghĩa đổi có chủ ý, không phải hồi quy bị che.

## Hệ quả

- **Ontology mục 6 phải sửa I-4** và bảng M-5 mục 7 — không sửa thì ontology thành trang trí, và test parity của P5 đã chứng minh lớp chống đó cắn thật.
- **Vòng quét từ nay chạy cả nhóm 3 và nhóm 4** mỗi vòng, vì nó gọi `ingest()` như mọi đường đọc khác. Đúng Specs, nhưng nghĩa là nhiều lần gọi LLM mỗi nhịp — I-10 (bỏ nhịp + `skipped_reason`) là cơ chế đã có cho chuyện đó, và ở chu kỳ 10s của T-8 thì **tràn nhịp là trạng thái bình thường**, không phải lỗi.
- Tin của công ty đang theo dõi mà người bấm đọc **lên dòng thời gian ngay**, không qua hàng đợi. Đó là điều nhãn Đang theo dõi đã hứa; màn `/dang-theo-doi` phải nói thẳng câu đó trước khi ai bấm công tắc (ADR-0006).
- `trigger_context` vẫn lưu và vẫn hiển thị. Nó trả lời *"lần đọc này do ai khởi động"* — một dữ kiện về bản lưu, có ích khi đọc lại nhật ký. Nó chỉ không còn là **quyền**.

## Câu hỏi còn treo

Không có câu nào chặn code. Một câu chuyển cho phase 8: Specs viết *"Sales vẫn xoá được một mục do hệ thống thêm, **như mọi mục khác**"* — mệnh đề phụ ngầm hứa mục do người gõ cũng xoá được, nhưng I-13 chỉ ràng buộc mục hệ thống và phase 7 chốt phạm vi hẹp (`created_by = 'system'`, mục người gõ → 403). Lý do hẹp: `stage_change` là vết đổi giai đoạn, xoá nó là xoá bằng chứng của một hành vi và cần ADR riêng.
