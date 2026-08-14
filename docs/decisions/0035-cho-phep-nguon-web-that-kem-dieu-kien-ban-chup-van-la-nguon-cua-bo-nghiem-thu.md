# ADR-0035 — Cho phép nguồn web thật kèm ba điều kiện; bản chụp vẫn là nguồn duy nhất của bộ nghiệm thu, công tắc chưa bật trước freeze

| | |
| --- | --- |
| **Ngày** | 2026-08-14 16:20 |
| **Giai đoạn** | Requirement (diễn giải Specs mục 3 — M-14) |
| **Trạng thái** | Chấp nhận — **chỉ mở cửa trong ontology, chưa có dòng code nào** |
| **Người quyết định** | trungmd |
| **Prompt log** | [ai-sessions/260814-1124-req-crawl-web-that.md](../ai-sessions/260814-1124-req-crawl-web-that.md) |

## Bối cảnh

`docs/ontology.md` mục 1 xếp "crawl web thật" vào danh sách **"không thuộc module này, đừng tự thêm"** — đọc lên thành một lệnh cấm vĩnh viễn. Nhưng thứ Specs thật sự ràng buộc (mục 3) là *"nguồn web trong đề bài chính là các bản chụp này"*: một ràng buộc để **mọi đội chạy trên cùng dữ liệu và giám khảo tái tạo được kịch bản**, không phải một phán quyết kiến trúc về sản phẩm. Hai thứ đó bị gộp làm một trong ontology, và gộp sai chỗ: một dòng cấm nằm trong file "nguồn sự thật về ràng buộc" sẽ sống lâu hơn cái cửa sổ chấm điểm sinh ra nó.

`/hack:req-challenge` (4 persona, prompt log ở trên) đã tìm ra rủi ro nặng nhất của việc đổi nguồn: **Nhóm 5 tự ghi thẳng vào dòng thời gian, không chờ duyệt** — cơ chế đó an toàn **chỉ vì** nội dung bản chụp do BTC kiểm soát. Bản nháp đầu của ADR này (chưa từng vào git) chốt hướng ngược lại — "không mở đường nguồn thật, giữ nguyên dòng cấm". Người quyết định đọc xong và chọn hướng khác: **mở cửa, kèm điều kiện**. Nháp đó không được giữ thành ADR riêng vì nó chưa từng được xác nhận bằng lời và chưa vào git; toàn bộ lập luận của nó nằm nguyên trong phương án B dưới đây.

Ràng buộc thời gian: feature freeze tối nay 14/08.

## Phương án đã cân nhắc

| Phương án | Ưu | Nhược | Kết luận |
| --- | --- | --- | --- |
| **A. Cho phép nguồn thật trong ontology kèm ba điều kiện (I-15 trần dừng ở vùng 2 · I-16 bộ seed chỉ đọc bản chụp · I-17 mặc định tắt), công tắc **không bật** trước khi ba điều kiện có test** | Ontology nói đúng bản chất: bản chụp là ràng buộc **của bộ nghiệm thu**, không phải giới hạn vĩnh viễn của sản phẩm · điều kiện được viết ra lúc còn tỉnh táo, không phải lúc vội bật · 0 rủi ro trước freeze vì không có dòng code nào đổi · trả lời được câu "sản phẩm này có đọc dữ liệu công khai thật không" bằng thiết kế, không bằng lời hứa | Ontology mô tả một đường chưa tồn tại trong code — phải ghi rõ là **cửa gác**, nếu không người đọc sau tưởng đã có · vẫn phụ thuộc một diễn giải Specs chưa được BTC xác nhận | ✅ **Chọn** |
| B. Giữ nguyên dòng cấm, không mở gì cả (nội dung bản nháp đầu) | Ít việc nhất; không ai hiểu nhầm là đã có nguồn thật | Để một ràng buộc **của cửa sổ chấm điểm** đóng vai luật kiến trúc trong file nguồn sự thật — sai bản chất, và là loại sai âm thầm: người sau đọc ontology sẽ không bao giờ biết dòng cấm đó thật ra từ đâu ra · thảo luận đã có (4 persona, 3 điều kiện, cái hố I-4/I-5) chết theo, lần sau phải nghĩ lại từ đầu | ❌ Loại — không phải vì sai kỹ thuật, mà vì ghi sai lý do vào đúng chỗ người sau tin nhất |
| C. Build luôn `OBSERVATION_SOURCE=snapshot\|live_crawl` trước freeze theo mẫu `useFactory` của [ADR-0014](0014-nhom-2-rut-phat-hien-bang-llm-that-code-kiem-cau-trich.md) | Khả thi kỹ thuật cao — `DemoSnapshotSource` đã là port injectable, comment trong code (`demo-snapshots.ts:240-244`) đã dự tính sẵn "a future real crawler can be swapped in" | Không thêm điểm nghiệm thu nào (giám khảo luôn chạy trên bộ dữ liệu BTC) · thêm external dependency thật (mạng, HTML thật, timeout, 403) vào đúng đêm freeze · ba điều kiện I-15…I-17 chưa có test, bật lên là bật một đường ghi chưa ai chặn | ❌ Loại — **cho đêm nay**, không loại vĩnh viễn: đây chính là việc mà A dọn đường cho |
| D. Thay hẳn bản chụp bằng nguồn thật | Đúng nghĩa đen "đọc dữ liệu công khai" | Phá T-6/T-8: "đổi bản chụp trước → sau" là cách **duy nhất** giám khảo tự kích hoạt và lặp lại kịch bản AI · vi phạm thẳng ràng buộc Specs mục 3 · một số công ty seed có website giả, không có gì để crawl | ❌ Loại — phá ràng buộc cứng của đề bài, không phải sở thích nội bộ |

## Quyết định

Chọn **A**. Bốn tiêu chí đã dùng để so, theo đúng thứ tự ưu tiên:

1. **Ontology phải ghi đúng bản chất của ràng buộc, không ghi đúng trạng thái tạm thời.** "Bản chụp là nguồn của bộ nghiệm thu" là sự thật lâu dài và kiểm được; "cấm crawl web thật" là kết luận của một cửa sổ 3 ngày, đội sau đọc sẽ tưởng là luật.
2. **Tính xác định của bộ nghiệm thu là bất khả xâm phạm.** Mọi công ty giám khảo chạm tới chỉ đọc bản chụp (I-16). Nguồn thật không được có mặt trong đường đi của T-1…T-10.
3. **Trần tự chủ là hàm của nguồn, không chỉ của tính năng.** Đây là phát hiện có giá trị nhất của phiên phản biện: vùng 3–4 an toàn nhờ nội dung nguồn **có người kiểm trước**, không nhờ nút Hoàn tác. Nguồn không ai kiểm thì trần dừng ở vùng 2 (I-15).
4. **Cửa mở không đồng nghĩa với công tắc bật.** Ba điều kiện chưa có test ⇒ theo đúng luật của chính mục 6 ontology (*không có test = coi như chưa làm*), công tắc không được bật. Freeze tối nay vì thế không chịu thêm một rủi ro nào.

Điểm mà cả bản nháp bị loại (B) lẫn quyết định này **đồng ý**: không viết crawler trước freeze. Khác nhau ở chỗ ontology nói gì về sau đó.

## Hệ quả

- **Kéo theo, đã làm:** `docs/ontology.md` bỏ "crawl web thật" khỏi danh sách cấm ở mục 1 và thêm mục **3.6** (bảng so hai loại nguồn), **I-15/I-16/I-17** ở mục 6, ngoại lệ nguồn thật ghi thẳng vào ô I-4 và I-5, dòng **M-14** ở mục 9, hai ô checklist mới ở mục 10. File chuyển về trạng thái **chờ duyệt lại** — mục 1 của chính nó bắt thế.
- **Kéo theo, chưa làm (cửa gác):** cột `source_kind` (`demo_snapshot` · `live_crawl`) và `fetch_error_reason` trên `observations`; ba test cho I-15…I-17; dòng `source_kind` trong bảng 3.5 + `enums.ts`. `source_kind` **cố ý chưa vào bảng 3.5**: bảng đó là hợp đồng có test (`ontology-enum-parity.test.ts` đọc thẳng bảng lúc chạy), khai một enum cho cột chưa tồn tại chỉ làm test đỏ — cùng cách xử lý đã dùng cho `user_role`.
- **Đánh đổi chấp nhận:** ontology từ giờ mô tả một đường chưa có trong code. Chống bằng cách nói thẳng trong file: đoạn ngay dưới bảng bất biến ghi *"ba bất biến này là cửa gác, không phải mô tả trạng thái hiện tại"*. Nếu ai đó đọc lướt và tưởng sản phẩm đang crawl thật thì đó là lỗi của đoạn văn đó, sửa đoạn văn.
- **Đánh đổi chấp nhận:** sản phẩm demo tối nay vẫn không "đọc thật" theo nghĩa đen. Nếu BGK hỏi, trả lời bằng đúng thiết kế này — ràng buộc Specs mục 3, cộng lý do trần tự chủ hạ một bậc — chứ không né.
- **Sẽ phải xem lại nếu:** BTC trả lời rằng bản chụp là nguồn **duy nhất được phép tồn tại** (câu hỏi đã ghi ở prompt log mục 6). Lúc đó **xoá** đường nguồn thật khỏi mục 1 và 3.6 — không phải nới thêm điều kiện. Chi phí xoá gần bằng 0 vì chưa có code.

## AI đã tham gia thế nào

- **Vai trò AI:** chạy `/hack:req-challenge` đóng 4 persona phản biện yêu cầu "thêm crawl web thật" (Sales trực chiến · Sales Manager · Tester/BA · người bảo vệ dữ liệu); scout Specs mục 3 + T-6/T-8 + ADR-0021/0022; đọc `demo-snapshots.ts`, `claim-extractor.provider.ts`, `ontology-enum-parity.test.ts` để biết chỗ nối và chỗ vướng; soạn bản sửa ontology.
- **AI đề xuất gì mà đội không nghe:** AI khuyến nghị **giữ nguyên dòng cấm trong ontology** (phương án B) và coi yêu cầu là hiểu nhầm phạm vi. Người quyết định **không nghe**, và đúng: AI đã lẫn giữa *"không build crawler trước freeze"* (đúng, cả hai bên đồng ý) với *"ontology phải ghi crawl web thật là thứ cấm"* (sai — đó là ràng buộc của bộ nghiệm thu bị chép nhầm thành luật kiến trúc). Quyết định cuối giữ phần kết luận thời gian của AI, bỏ phần diễn giải Specs của AI.
- **AI sai ở đâu:** hai lần trong cùng chủ đề. (1) Đánh giá đầu coi yêu cầu chỉ là hiểu nhầm phạm vi, chưa đọc code — sau mới thấy `DemoSnapshotSource` vốn đã là port injectable dựng sẵn cho đúng việc này. (2) Nhầm ràng buộc chấm điểm thành ràng buộc thiết kế, như trên. Cả hai đều là **đọc thiếu trước khi kết luận**, không phải suy luận sai.

## Đội đã verify bằng cách nào

- Đối chiếu thẳng văn bản đề bài, không suy diễn: `docs/hackathon-spec-ai-native-crm.md:56` (mục 3 — câu ràng buộc nguồn), `:191` và `:193` (T-6, T-8 — kích hoạt bằng đổi bản chụp). Ba dòng này là cơ sở của I-16.
- Đọc mã nguồn xác nhận điểm nối có thật, không phải giả định: `apps/api/src/ai/demo-snapshots.ts:240-244` (comment dự tính crawler thật), `apps/api/src/ai/claim-extractor.provider.ts` (mẫu `useFactory` theo env đã chạy thật ở ADR-0014).
- **Đo được vì sao `source_kind` chưa vào bảng 3.5:** đọc `packages/contracts/src/__tests__/ontology-enum-parity.test.ts:83` — test assert đúng **12 dòng** đọc từ bảng 3.5 và assert mọi enum trong `ENUMS` đều được ontology khai. Thêm dòng thứ 13 cho một cột chưa tồn tại làm test đỏ ngay. Tiền lệ xử lý đã có sẵn trong `enums.ts:183-189` (`USER_ROLE` nằm ngoài `ENUMS`, kèm comment giải thích).
- **Kiểm cái hố I-4/I-5 bằng bảng hai chiều**, đúng cách [ADR-0028](0028-quyen-ghi-muc-dong-thoi-gian-den-tu-nhan-dang-theo-doi-khong-tu-trigger-context.md) đã dùng: công ty `is_watched = true` + nguồn thật, nếu chỉ viết "nguồn thật không sinh mục" mà quên lật chiều I-5, thì I-15 chặn mục **và** I-5 chặn gợi ý ⇒ phát hiện không có đường nào ra, và I-3 (hash trùng) làm nó vĩnh viễn. Vì vậy I-15 viết thành **hai vế**, không phải một.
- Phản biện là 4 persona độc lập có log, không phải một ý kiến đơn lẻ của AI: `docs/ai-sessions/260814-1124-req-crawl-web-that.md`.
- **Chưa verify được, nói thẳng:** diễn giải Specs mục 3 chưa có BTC xác nhận; ba bất biến I-15…I-17 chưa có test nào. Đó chính là lý do công tắc để tắt.

## Rollback

Ba mức, chi phí tăng dần:

1. **BTC trả lời "bản chụp là nguồn duy nhất được phép"** → xoá mục 3.6, ba bất biến, dòng M-14, trả mục 1 về danh sách cũ. ~15 phút, không chạm code, không chạm test.
2. **Đội thấy ontology gây hiểu nhầm** (ai đó tưởng đã có crawl thật) → giữ 3.6 nhưng đổi tiêu đề thành "chưa mở", siết đoạn cửa gác. ~5 phút.
3. **Đã build xong nguồn thật rồi mới thấy sai** → `OBSERVATION_SOURCE` về `snapshot` là xong, đúng theo I-17 (nhánh an toàn là nhánh mặc định). Dữ liệu `live_crawl` đã sinh không bị xoá, giống phạm vi nút tắt AI ở [ADR-0009](0009-pham-vi-nut-tat-ai-chi-dung-sinh-moi.md).

---

**Cần xác nhận trước khi dùng ADR này trả lời vòng 2:** mục *"AI đề xuất gì mà đội không nghe"* ghi lại lý do người quyết định chọn A thay vì B theo cách AI hiểu từ chỉ thị *"sửa ontology.md để cho phép crawl data thật kèm điều kiện"* — người quyết định nên đọc lại đoạn đó và sửa nếu lý do thật khác.
