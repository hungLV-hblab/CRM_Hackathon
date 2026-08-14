# Prompt log — 14/08/2026 21:50 · Brainstorm: lưu ứng viên nguồn, công tắc tắt nguồn, panel hết chật

> **Đây là đề thi vòng 2.** Viết cho người đọc lại sau ba tuần, không phải cho người vừa ngồi trong phiên.
> Tiền đề: [ADR-0036](../decisions/0036-llm-tim-nguon-code-doc-bytes-va-ung-vien-phai-qua-nguoi.md) đã chốt hai bước tìm → tick, và [prompt log 260814-1600](260814-1600-brainstorm-crawl-da-nguon.md) chứa lập luận gốc. Phiên này **không mở lại** câu "ai được ghi vào danh sách đọc".
> Kết quả: [ADR-0037](../decisions/0037-ung-vien-luu-o-bang-ai-khong-doc-duoc-va-cong-tac-tat-nguon.md) · [plan năm chặng](../../plans/260814-2150-luu-ung-vien-nguon-va-cong-tac-bat-tat/plan.md)

## Yêu cầu gốc của người quyết định

> Ứng viên nguồn tìm được mà **reload là mất**. Bấm Lưu cũng mất. Mỗi lượt tìm 10–20 giây và tốn tiền. Cho **select / unselect / xoá** được. Với lại panel đó **chật** quá.

Ba việc, một màn hình. Việc thứ ba rẻ nhất nhưng thấy được ngay.

**Điều phải nói thẳng ngay từ đầu phiên, và AI nói trước khi bàn giải pháp:** đây **không phải bug**, đây là **đảo một phần quyết định đã ghi ADR**. ADR-0036 mục (b) chọn "tìm → trả ứng viên → người tick → mới ghi", và Hệ quả ghi nguyên văn *"Đánh đổi đã nhận: refresh trang mất danh sách ứng viên"*. Có một test đếm `company_sources = 0` sau `findCandidates` để chốt điều đó. Vậy thay đổi này **bắt buộc kèm ADR mới**, không được lặng lẽ sửa.

## Năm câu hỏi, và người quyết định chọn gì

### 1. Lưu ứng viên ở đâu?

**AI đưa ba phương án**, và khuyến nghị **bảng riêng** `company_source_candidates`.

Lập luận AI dùng: hôm nay *"có hàng trong `company_sources`" nghĩa là "một người đã tick"*, và `0008_live_source.sql` biến câu đó thành **quyền CSDL** (I-18). Một cột `status ('candidate' | 'selected')` giữ cả hai loại hàng trong một bảng, nên mọi reader phải nhớ viết `WHERE status = 'selected'` để còn đúng — enforcement tụt từ *quyền CSDL* xuống *nhớ viết WHERE*. Với bảng riêng thì `crm_system` **không được grant gì** và AI không đọc nổi danh sách ứng viên của chính nó.

**Người quyết định đồng ý.**

Câu hỏi kiểm tra ở vòng 2: *thêm một cột thì rẻ hơn hẳn, sao lại thêm cả một bảng?* — trả lời được bằng câu "hàng tồn tại = đã duyệt" hoặc chưa hiểu quyết định này.

### 2. "Select / unselect" nghĩa là gì?

Câu này hoá ra **hai việc khác nhau**, và người quyết định chốt là **cả hai**: tick ứng viên vào/ra danh sách đọc, **và** bật/tắt một nguồn đã lưu mà không xoá nó.

Lý do bật/tắt không thay được bằng xoá: xoá là mất luôn `search_snippet` và lý do đã chọn trang đó. "Chưa bao giờ đưa vào" khác "đã đưa vào nhưng tạm ngưng đọc".

### 3. Bấm "Tìm nguồn công khai" lần nữa thì sao?

**Thay thế** danh sách ứng viên cũ (DELETE rồi INSERT, một transaction), không cộng dồn.

Cộng dồn thì phình dần, cần trần cứng và cách dọn, và ứng viên đã bị bỏ qua ba lần vẫn ngồi đó. Giá đã nhận: một ứng viên xoá tay sẽ **quay lại** ở lần tìm sau — chấp nhận, YAGNI, bỏ qua nó lần nữa mất một giây.

### 4. Cột `enabled` — chỗ AI cảnh báo TRƯỚC, không phải sau

Đây là phần đáng kể lại nhất của phiên. Ngay khi bàn tới cột `enabled`, AI chỉ ra nó **tái tạo đúng cái lỗ vừa dùng để loại phương án cột `status`** ở câu 1: `crm_system` có `SELECT` toàn bảng `company_sources`, nên quên một `WHERE enabled` ở một chỗ là AI đọc trang người ta vừa tắt — và **đọc thành công, im lặng**, kèm một lượt gọi LLM có phí.

Bắt được ở **bàn thiết kế**, không phải ở code review, vì hai mục nằm cạnh nhau trong cùng một bảng so sánh.

**AI khuyến nghị:** `REVOKE SELECT ON company_sources FROM crm_system` + view `company_sources_enabled` + `GRANT SELECT` trên view. Đắt hơn phương án `WHERE enabled` chừng 20 phút. **Người quyết định chọn view.**

Lý do: quên filter thì thành `permission denied` **ồn ào**, không phải đọc lén thành công — và cả tính năng này được xây trên nguyên tắc đó.

Kéo theo, biết trước và cố ý: **một test đang xanh bị đảo.** Test 15 khẳng định `crm_system` đọc được `company_sources`. Câu đó đúng một nửa — crawler cần các trang **đang bật**, còn đọc bảng thì được cả trang từng được thêm. Viết lại thành ba khẳng định, không xoá.

### 5. Panel chật thì làm gì?

Section **full-width** đặt sau thẻ đóng của grid hai cột. Dialog toàn màn và `Sheet` trượt từ phải đều bị loại **vòng này**: tick trong modal thì không thấy song song danh sách đã lưu để so, mà so hai danh sách chính là việc người dùng đang làm.

## Chỗ AI đề xuất sai, thi công mới lộ

**Bản plan đề nghị bỏ nút "Lưu N nguồn đã chọn".** Lập luận nghe rất hợp: khi trạng thái tick đã ở server (`savedSourceId`) thì tick chính là lưu, và biến `picked` hết lý do tồn tại.

Lúc thi công mới thấy điều plan không biết: nhánh đang có tính năng **đọc ngay sau khi lưu**, và một lần đọc là một lượt fetch cộng một lượt gọi LLM **cho từng URL đã lưu**. Bỏ nút thì tick 4 ứng viên thành **4 lần đọc trả tiền riêng**.

**Người quyết định giữ nút.** Ứng viên vẫn persist qua reload — yêu cầu gốc vẫn đạt, và cái giá bằng 0.

Bài học đáng ghi: một quyết định UI nhìn từ *model state* thì gọn, nhìn từ *hoá đơn* thì sai. Plan không biết vì phần việc đó chưa commit lúc plan được viết.

**AI cũng đề xuất một con số thừa:** plan đề nghị `MAX_CANDIDATES_PER_COMPANY = 12`. Đọc code mới thấy `anthropic-source-discovery.ts` đã cắt ở **6**, kèm lý do viết sẵn — *"một người phải đọc và tick từng hàng; sáu là một quyết định, mười hai là một việc nhàm"*. Lấy đúng số đã có, không thêm số thứ hai để hai chỗ lệch nhau về sau.

## Việc dễ quên, soi ra trước khi code

- **`ALL_TABLES`** phải có bảng mới, không thì reseed (I-14) để lại rác và test rò hàng giữa các file.
- **`ontology.md`** sửa 5 dòng: bảng thực thể · danh sách route (`"KHÔNG ghi gì"` hết đúng) · dòng đánh đổi refresh · thứ tự đọc phải kể `enabled` · I-18.
- **ADR-0036** đánh dấu hai dòng bị thay, **không xoá** — và mục (b) của nó **không bị đảo**.
- **Comment trong code** nói ứng viên không được lưu: ba chỗ (service, controller, port `source-discovery.ts`). Đây là chỗ dễ để lại nhất, và là đúng cái bẫy vòng 2.

## Câu chưa trả lời sau phiên

1. `found_by` sẽ mất nghĩa "ai bấm" nếu sau này vòng quét gọi `findCandidates`. Hiện không gọi.
2. Thứ tự ứng viên là **theo url**, không theo thứ hạng model trả về — mọi hàng của một lượt tìm chia nhau một `found_at`. Không thêm cột `rank` vì sản phẩm không dùng thứ hạng đó; nếu sau này màn hình xếp theo độ liên quan thì phải thêm.
3. Danh sách ứng viên hiện là của **công ty**, không của **người**. Hai người cùng xem một công ty thấy cùng một danh sách và xoá được của nhau.
