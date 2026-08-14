# ADR-0031 — Mẫu số của error-detection rate là ba tập AI đưa ra trước mặt người, không gồm toàn bộ phát hiện

| | |
| --- | --- |
| **Ngày** | 2026-08-14 10:12 |
| **Giai đoạn** | Design (nhóm 6, bảng điều khiển) |
| **Trạng thái** | Chấp nhận — **đã đo 14/08 11:00, nợ đo đã trả** (9 test đơn vị + 1 phép đo đột biến) |
| **Người quyết định** | HungLV |
| **Prompt log** | phiên phản biện phase 8 ngày 14/08 10:12 — [báo cáo](../../plans/reports/from-brainstorm-to-planner-260814-1012-phase-08-nhom-6-bang-dieu-khien-va-bo-nghiem-thu-report.md) |

## Bối cảnh

[Ontology mục 7](../ontology.md#7-chỉ-số-đo-từ-ngày-đầu) viết công thức error-detection rate là `(reject[wrong_info] + reject[misread_context] + số lần Hoàn tác + số lần xoá mục hệ thống) / tổng output AI`. Tử số chỉ đúng bốn nguồn, đếm được ngay. **Mẫu số ghi "tổng output AI" — không đủ để viết một câu SQL**, và hai cách đọc cho hai con số khác hẳn nhau.

Chỉ số này là một trong hai số Specs đòi đo từ ngày đầu (luật 6), nên nó sẽ nằm trên màn hình trước mặt BGK. Chọn sai mẫu số không làm hỏng code, nó làm hỏng **câu trả lời ở vòng 2**.

Phase 8 viết 13/08 chép nguyên công thức từ ontology mà không ai nhận ra mẫu số chưa được định nghĩa — lỗ này sống một ngày rưỡi.

## Phương án đã cân nhắc

| Phương án | Ưu | Nhược | Kết luận |
| --- | --- | --- | --- |
| **A. Mẫu số = `proposals + auto_next_step_events + timeline_entries(created_by='system')`** — đúng tập AI đưa ra trước mặt người | Mọi số hạng của tử số **chỉ phát sinh trên đúng ba tập này**: Bỏ là quyết định trên `Proposal`, Hoàn tác là trên `AutoNextStepEvent`, xoá mục hệ thống là trên `TimelineEntry`. Tỉ lệ luôn ≤1 và đọc lên thành một câu: "trong 100 thứ AI đặt trước mặt tôi, tôi bắt được bao nhiêu cái sai" | Không đếm phát hiện bị cửa chặn code loại trước khi tới tay người (G2, I-5) — công sức AI bỏ ra không hiện trong mẫu số | ✅ **Chọn** |
| B. Cộng thêm toàn bộ `claims` | Đọc sát nghĩa đen chữ "tổng output AI"; đếm được cả phần AI làm mà người không thấy | Mẫu số phình bằng những phát hiện **chưa từng đến tay ai** ⇒ tỉ lệ tụt xuống gần 0 và **không có hành vi nào của người làm nó tăng đáng kể**. Một chỉ số không bao giờ sai được thì không đo gì. Tệ hơn: nó **thưởng cho việc sinh nhiều claim** — sinh thêm 100 claim vô hại là tỉ lệ đẹp hơn | ❌ Loại |
| C. Mẫu số = tổng số **quyết định** của người (`count(proposal_decisions)`) | Cùng bản chất với auto-accept rate, dữ liệu sẵn | Tử số có Hoàn tác và xoá mục hệ thống — **hai thứ không đi qua `proposal_decisions`** ⇒ tử số có thể lớn hơn mẫu số, tỉ lệ vượt 1. Sai về mặt số học chứ không phải sai về diễn giải | ❌ Loại |

## Quyết định

Chọn **A**. Tiêu chí so là **"tử số và mẫu số có cùng miền không"**: mỗi số hạng tử số phải là một sự kiện xảy ra **trên một phần tử của mẫu số**. A thoả, C vi phạm trực tiếp (tỉ lệ vượt 1), B thoả về hình thức nhưng nhồi vào mẫu số một tập mà tử số **không thể** phát sinh trên đó — hiệu ứng giống hệt việc chia cho một hằng số lớn tuỳ ý.

Kèm hai luật hiển thị, cùng một lý do:

- **Mọi tỉ lệ trên bảng điều khiển hiện kèm mẫu số** — "3/12", không phải "25%" trơ trọi.
- **Mẫu số 0 → trả `null`, giao diện hiện "chưa có dữ liệu"**, không hiện `0%`. `0%` error-detection rate đọc lên là "người không bắt được lỗi nào", trong khi sự thật là "chưa có gì để bắt" — đúng loại dòng dữ liệu sai mà [luật 4](../../CLAUDE.md#2-bảy-luật-bất-di-bất-dịch) nói tệ hơn để trống.

## Hệ quả

- Kéo theo: `apps/api/src/domain/metrics/` phải chạy **ba câu đếm** cho mẫu số, không phải một. Ba bảng thuộc ba nhóm tính năng khác nhau (3, 4, 5) nên bất cứ nhóm nào tắt đi thì mẫu số tụt theo — đó là hành vi đúng.
- Kéo theo: bảng điều khiển cần chỗ cho **cỡ mẫu bên cạnh mỗi con số**, không chỉ con số. Ảnh hưởng bố cục màn Quản trị.
- Đánh đổi chấp nhận: công của AI ở phần bị cửa chặn code loại (G2 loại đề xuất, I-5 chặn `timeline_entry`) **không hiện trong chỉ số nào**. Phiên 6 đã cho thấy số đếm theo từng cửa chặn mới là thứ chẩn được prompt sai; nếu cần thì đó là một khối riêng trên bảng điều khiển, **không phải bằng cách nhét vào mẫu số này**.
- Sẽ phải xem lại nếu: BGK hỏi thẳng "tổng output AI của các anh là bao nhiêu" và không chấp nhận con số chỉ gồm ba tập — khi đó **thêm một dòng riêng** "tổng phát hiện đã sinh" cạnh chỉ số, chứ không đổi mẫu số.

## AI đã tham gia thế nào

- Vai trò AI: phát hiện lỗ hổng (mẫu số chưa định nghĩa) + sinh ba phương án + phân tích trade-off.
- **AI sai ở đâu:** chính AI đã viết phase file 13/08 với bảng chỉ số chép nguyên công thức từ ontology, **không nhận ra "tổng output AI" chưa được định nghĩa ở đâu cả**. Lỗ sống một ngày rưỡi và chỉ lộ ra khi phiên phản biện đọc lại repo trước khi code. Cùng hình dạng với các lỗi P4/P5/P6/P7: phase file viết trước khi code tồn tại thì mọi con số trong đó là giả thiết.
- **AI đề xuất mà đội không nghe:** trong lúc trình bày, AI ước lượng phương án B làm mẫu số "phình 5–10 lần". Đội **bác con số đó** vì nó không dựa trên phép đo nào — số đo thật đã ghi ở phiên 6 (11 draft claim trên cùng bộ bản chụp sinh ra 3 thẻ hàng đợi) chỉ cho phép nói **ít nhất 2–3 lần trên bộ demo 5 công ty**. Lý do loại B không đổi vì nó là lý do cấu trúc (tử số không phát sinh trên `claims`), không phải lý do độ lớn.

## Đội đã verify bằng cách nào

1. **Đọc mã nguồn, ghi số dòng, để đối chiếu tử số với mẫu số:** cả bốn số hạng tử số đều có nguồn riêng — `proposal_decisions.reject_reason` (`packages/db/src/schema/proposal-decisions.ts:30`), `auto_next_step_events.undone_at`, và `audit_events.action = 'delete_system_timeline_entry'` (hợp đồng P7, **đã chạy thật từ 14/08 03:38**). Không số hạng nào đọc từ `claims` ⇒ khẳng định "tử số không phát sinh trên `claims`" là đọc được từ schema, không phải suy đoán.
2. **Đối chiếu với số đo cũ, không bịa số mới:** phiên 6 (13/08 22:32, LLM thật, 3 lượt) ghi 11 draft claim và 3 thẻ hàng đợi trên cùng bộ bản chụp ⇒ mẫu số B lớn hơn mẫu số A ít nhất 2 lần **ngay trên bộ demo 5 công ty**, và khoảng cách chỉ rộng ra khi dữ liệu thật vào.
3. **Nợ đo đã trả, 14/08 11:00** — `apps/api/src/domain/metrics/__tests__/metrics-counts-what-reached-a-person.test.ts`, 9 test xanh trên CSDL thật:

   | Khẳng định | Test |
   | --- | --- |
   | `edit` không cộng vào `accept`, và nằm trong mẫu số của auto-accept (I-12) | test 1 |
   | Mẫu số 0 → `null`, không phải 0 | test 2 · test 9 |
   | Mẫu số đếm **đúng ba tập**, itemised | test 3 |
   | 9 phát hiện thêm **không** làm mẫu số nhúc nhích | test 4 |
   | Tử số đếm đúng bốn nguồn; `reject[irrelevant]` **không** vào tử số | test 5 |
   | Lần hệ thống **bị chặn** xoá không tính là người bắt được lỗi | test 6 |

4. **Phép đo đột biến, chạy 14/08 11:05:** đổi auto-accept thành `accept / (accept + reject)` → test 1 đỏ ngay với `expected { rate: 0.666… } to deeply equal { rate: 0.5 }`. Đã hoàn nguyên. Đây là bằng chứng I-12 được **đo** chứ không chỉ được viết trong comment.

## Rollback

Đổi mẫu số là sửa **một hàm trong `metrics-service.ts`** và một nhãn trên màn hình. Không migration, không đổi schema, không mất dữ liệu — mọi số đều tính lại từ bảng gốc mỗi lần gọi. ~10 phút.
