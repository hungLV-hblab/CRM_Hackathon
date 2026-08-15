# ADR-0036 — LLM quyết đọc ở đâu, code quyết cái gì được lưu; URL ứng viên phải qua một cú bấm của người

| | |
| --- | --- |
| **Ngày** | 2026-08-14 21:20 |
| **Giai đoạn** | Development |
| **Trạng thái** | Chấp nhận |
| **Người quyết định** | trungmd |
| **Prompt log** | [ai-sessions/260814-1600-brainstorm-crawl-da-nguon](../ai-sessions/260814-1600-brainstorm-crawl-da-nguon.md) · tiền đề ở [260814-1124](../ai-sessions/260814-1124-req-crawl-web-that.md) |

## Bối cảnh

[ADR-0035](0035-cho-phep-nguon-web-that-kem-dieu-kien-ban-chup-van-la-nguon-cua-bo-nghiem-thu.md) đã mở cửa cho nguồn web thật kèm ba điều kiện (I-15, I-16, I-17), nhưng để lại đúng câu khó: **làm sao biết đọc trang nào.** `SNAPSHOTS` chỉ có 5 công ty seed, nên mọi công ty Sales tự thêm qua giao diện rơi vào vùng đọc vĩnh viễn trống — `snapshots.read()` trả `null`, và không có cơ chế nào lấp.

Ràng buộc siết từ ba phía: freeze tính năng tối 14/08; crawl thật **không thêm điểm nghiệm thu nào** (giám khảo chạy T-1…T-10 trên bộ seed, mà I-16 chặn nguồn thật khỏi seed); và mọi đường ghi mới đều phải đi qua luật 3 của CLAUDE.md — máy chuẩn bị sẵn, người quyết định ghi.

## Phương án đã cân nhắc

### (a) Tìm nguồn ở đâu ra

| Phương án | Ưu | Nhược | Kết luận |
| --- | --- | --- | --- |
| A. `web_search` của Anthropic tìm URL, **code của mình** fetch bytes | URL đến từ chỉ mục tìm kiếm thật; mình vẫn giữ từng byte | Thêm một lượt gọi LLM, $10/1000 lượt tìm | ✅ **Chọn** |
| B. Để LLM tự nghĩ ra URL từ tên công ty | Không tốn lượt tìm | **Bịa.** Một địa chỉ không ai tra được là vi phạm thẳng luật 1 và luật 4 | ❌ Loại |
| C. Search API riêng (Brave/Tavily) | Rẻ hơn một chút | Thêm vendor, thêm khoá, thêm đường lỗi — đổi lại **0 lợi ích** so với A | ❌ Loại |
| D. `web_fetch` của Anthropic lấy luôn nội dung | Ít code nhất | **Mất byte gốc.** [ADR-0012](0012-ban-luu-giu-html-goc-va-text-trich-offset-tinh-tren-text.md) tính `content_hash` và mọi `quote_start`/`quote_end` trên `raw_content` **của mình**; để model tải và tóm tắt thì cửa I-2 (câu trích là chuỗi con nguyên văn) không còn gì để đối chiếu, và provenance sụp theo | ❌ Loại |

### (b) Ai được ghi vào danh sách nguồn

| Phương án | Ưu | Nhược | Kết luận |
| --- | --- | --- | --- |
| A. Tìm → **trả về ứng viên** → người tick → mới ghi | Giữ đúng luật 3; `crm_system` không cần INSERT | Refresh trang mất danh sách ứng viên | ✅ **Chọn** |
| B. Tìm xong tự lưu vào danh sách đọc | Ít một cú bấm | **AI tự chọn nguồn nó sẽ rút phát hiện** — phá đúng nguyên tắc đã enforce cho `snapshot_variant` (`companies.ts:39`), và là đường ghi thứ ba ngoài hai ngoại lệ Specs mở | ❌ Loại |

### (c) I-3 so hash theo cái gì

| Phương án | Ưu | Nhược | Kết luận |
| --- | --- | --- | --- |
| A. So theo `(company_id, source_url)` | Đúng nghĩa "khác bản lưu gần nhất **của nguồn đó**" | Cần thêm index | ✅ **Chọn** |
| B. Giữ so theo công ty | Không phải sửa gì | Đa URL làm hash của URL A bị so với bản lưu của URL B ⇒ **mỗi lần đọc sinh N hàng và N lượt gọi LLM**. Test cũ vẫn xanh khi hỏng, vì bản chụp mỗi công ty đúng 1 URL | ❌ Loại |
| C. Thêm `UNIQUE (company_id, content_hash)` | CSDL tự chặn | Đã bị loại từ [ADR-0017](0017-i3-enforce-o-tang-service-rang-buoc-csdl-chi-danh-cho-ranh-gioi.md): index toàn cục chặn cả chuỗi trước → sau → trước mà giám khảo tạo ra khi chạy lại T-6/T-8 | ❌ Loại |

### (d) Mạng xã hội

| Phương án | Ưu | Nhược | Kết luận |
| --- | --- | --- | --- |
| A. Cho vào kết quả tìm, **được phép hỏng** | Bảng phân loại lỗi có bằng chứng sống; `js_required` phân biệt được "trang chặn máy đọc" với "công ty không đăng gì" | Demo có dòng đỏ | ✅ **Chọn** |
| B. `blocked_domains` chặn trước | Demo đẹp hơn | Mất đúng thứ Sales Manager chất vấn ở [prompt log 260814-1124](../ai-sessions/260814-1124-req-crawl-web-that.md) mục 2 | ❌ Loại |

### (e) Nhóm 4 (tự đặt Việc tiếp theo) với `live_crawl`

| Phương án | Ưu | Nhược | Kết luận |
| --- | --- | --- | --- |
| A. Chạy **chế độ chỉ-đề-xuất**: vẫn tính ra Việc tiếp theo, đẩy hết sang `blockedNextSteps` → gợi ý `next_step` | Hàm ý về Việc tiếp theo vẫn tới được người dùng, đúng câu I-15 "chỉ sinh được `Proposal`" | Thêm một tham số | ✅ **Chọn** |
| B. Bỏ hẳn nhóm 4 với nguồn thật | Ít code hơn | `blockedNextSteps` là đường **duy nhất** biến hàm ý đó thành gợi ý ⇒ nó **biến mất không dấu vết**: không log, không đếm, không exception. Cùng hình dạng cái hố [ADR-0028](0028-quyen-ghi-muc-dong-thoi-gian-den-tu-nhan-dang-theo-doi-khong-tu-trigger-context.md) ở một tầng khác | ❌ Loại |
| C. Bỏ hẳn nhưng đếm/log | Khoảng trống đo được | Đo được mà Sales vẫn không thấy gì — sửa thước đo chứ không sửa sản phẩm | ❌ Loại |

**Phát hiện trong phiên validation, không có trong bản plan đầu.**

### (f) `fetch_error_reason` có vào `ENUMS` / bảng 3.5 không

| Phương án | Ưu | Nhược | Kết luận |
| --- | --- | --- | --- |
| A. Giữ **ngoài** `ENUMS`, như `USER_ROLE` | Bảng 3.5 chỉ liệt kê enum tồn tại như **một kiểu Postgres**; đây là `text` + CHECK, giống `source_tier` và `snapshot_variant` trên cùng bảng | Nó *có* nhãn hiển thị cho Sales, mà đó chính là tiêu chí để một enum thuộc 3.5 | ✅ **Chọn** |
| B. Vào `ENUMS` + bảng 3.5 | Nhất quán theo tiêu chí "có nhãn cho Sales" | Ontology dài thêm 10 giá trị chẩn đoán | ❌ Loại |

**Ghi rõ: đây là một lựa chọn, không phải chân lý.** Lập luận ngược đứng được, và nếu sau này bảng lỗi có mặt trên màn hình quản trị thì nên đảo.

### (g) Bảng lỗi có mấy giá trị — *quyết định phát sinh lúc thi công*

Danh sách chín giá trị được chốt **trước khi có dòng code nào mở socket**, và lần đọc thật đầu tiên lộ ra nó **không có ô nào** cho DNS không phân giải / kết nối bị từ chối / bắt tay TLS hỏng.

| Phương án | Kết luận |
| --- | --- |
| A. Thêm giá trị thứ mười `unreachable` (migration `0009`) | ✅ **Chọn** |
| B. Dồn vào `timeout` | ❌ Loại — nhãn là "Trang không phản hồi kịp", nói về một kết nối bị từ chối sau 3ms là **một dòng sai** (luật 4) |
| C. Dồn vào `invalid_url` | ❌ Loại — bảo Sales đi sửa một địa chỉ đúng mà chỉ đang chết |

### (h) Cửa gác SSRF đặt ở đâu — *quyết định phát sinh lúc thi công*

Bản plan để `fetchPage` **không** gọi cửa gác, để test dùng được `127.0.0.1`. Thi công xong mới thấy lỗ: một URL công khai 302 sang `169.254.169.254` đi lọt — đúng bài SSRF sách giáo khoa.

| Phương án | Kết luận |
| --- | --- |
| A. `assertAllowed` là **tham số bắt buộc** của `fetchPage`, được hỏi lại ở **từng hop** chuyển hướng | ✅ **Chọn** — cửa gác vẫn là hàm thuần và vẫn test được bằng bảng, nhưng bỏ qua nó là một dòng **nhìn thấy được** trong file test (`ALLOW_LOOPBACK`), không phải thứ code sản phẩm quên được |
| B. Giữ nguyên plan | ❌ Loại — chỉ kiểm địa chỉ người gõ thì dịch vụ metadata cách đúng một cú chuyển hướng |
| C. Ghép cửa gác vào trong `fetchPage`, không tham số hoá | ❌ Loại — test tích hợp buộc phải gọi internet thật, mà test gọi internet thật là test hỏng |

Kéo theo: chuyển hướng đi **theo tay** thay vì `redirect: 'follow'`, vì bản dựng sẵn không có chỗ nào để hỏi.

## Quyết định

**Ranh giới một dòng: LLM quyết *đọc ở đâu*; code quyết *cái gì được lưu và trích thế nào*.**

Tiêu chí dùng để so, không phải "đơn giản hơn": **cách nào giữ được cửa I-2.** I-2 đòi câu trích là chuỗi con nguyên văn của `raw_content`, và `raw_content` chỉ có nghĩa khi mình sở hữu byte gốc. Mọi phương án làm mất byte gốc (D ở mục a) bị loại bất kể tiện đến đâu. Mọi phương án để AI tự chọn nguồn (B ở mục b) bị loại vì nó phá nguyên tắc đã enforce bằng GRANT cho `snapshot_variant`.

## Hệ quả

- **Kéo theo:** bảng mới `company_sources` với đúng một dòng GRANT — `GRANT SELECT ON company_sources TO crm_system`, không INSERT, không UPDATE. Đây là chỗ "AI không tự chọn nguồn nó đọc" thành **ràng buộc CSDL** chứ không phải một câu trong doc.
- **Kéo theo:** `ObservationService` đọc theo **danh sách URL**; `company_sources` không rỗng thì thắng, rỗng thì rơi về `companies.website` (quyết định V4).
- **Đánh đổi đã nhận:** hai nguồn sự thật cho câu "đọc ở đâu" ⇒ thứ tự ưu tiên phải có test riêng, không được để ngầm định.
- **[Bị thay bởi [ADR-0037](0037-ung-vien-luu-o-bang-ai-khong-doc-duoc-va-cong-tac-tat-nguon.md)]** ~~**Đánh đổi đã nhận:** refresh trang mất danh sách ứng viên. Thao tác mất 10–20 giây, và đổi lại là giữ được nguyên tắc.~~ → Cái giá này đã **trả xong** mà không mất nguyên tắc: ứng viên lưu ở `company_source_candidates`, bảng mà `crm_system` không có quyền nào. Mục (b) dưới đây **không bị đảo** — phương án B ("tìm xong tự lưu vào danh sách đọc") vẫn bị loại.
- **Đánh đổi đã nhận:** không có `ANTHROPIC_API_KEY` thì `FixtureSourceDiscovery` suy ứng viên từ website đã lưu và **nói thẳng trong mỗi `reason`** rằng chưa chạy tìm kiếm thật. Suy giảm trung thực, không phải giả vờ đã tìm.
- **[Bổ sung bởi [ADR-0039](0039-tim-nguon-qua-agent-runtime-xac-minh-bang-cach-mo-that-tung-dia-chi.md)]** `web_search` của SDK **không còn là đường duy nhất** cho port này: có thêm adapter đi qua `agent-runtime` (Claude CLI + `WebSearch`). Ranh giới ở mục *Quyết định* **không đổi** — LLM vẫn chỉ quyết *đọc ở đâu*, code vẫn fetch bytes, ứng viên vẫn phải qua một cú bấm của người. Cái đổi là **cách chứng minh URL không bị bịa**: CLI không trả về khối `web_search_tool_result` để đối chiếu, nên đường đó **mở thật từng địa chỉ** và bỏ địa chỉ không trả lời.
- **Sẽ phải xem lại nếu:** vòng quét bắt đầu tự crawl (khi đó robots.txt và rate-limit theo host quay lại phạm vi — hiện ngoài phạm vi vì mỗi cú fetch là do người bấm vào URL người đó tự chọn); hoặc BTC trả lời rằng bản chụp là nguồn **duy nhất được phép tồn tại**, khi đó **xoá** đường nguồn thật chứ không nới thêm điều kiện.

## AI đã tham gia thế nào

- **Vai trò AI:** sinh phương án, phản biện thiết kế, và thi công.
- **AI đề xuất gì mà đội không nghe — hai lần, và người quyết định đúng cả hai:**
  1. AI khuyến nghị **chặn mạng xã hội** bằng `blocked_domains` cho demo sạch. Người quyết định chọn ngược: cho vào để **hỏng trung thực**. Đúng — nếu chặn thì `js_required` không bao giờ xuất hiện, và giá trị đắt nhất của cả bảng lỗi trở thành một dòng chết trong code.
  2. AI khuyến nghị chặn công ty seed bằng **quy tắc cấu trúc** (suy từ việc công ty có bản chụp hay không). Người quyết định chọn danh sách ID dẫn xuất thẳng từ `SEED_COMPANIES`. Đúng — quy tắc cấu trúc im lặng đổi nghĩa khi bộ seed đổi, còn danh sách ID thì hỏng ồn ào.
- **AI sai ở đâu:** ba chỗ, tìm ra bằng cách chạy chứ không bằng đọc lại.
  1. Bản plan do AI viết để `fetchPage` **không** gọi cửa gác SSRF — hở đường chuyển hướng (mục h). Không ai bắt được lúc review plan; test hop thứ hai mới bắt được.
  2. Bản plan chốt **chín** giá trị lỗi trước khi mở socket lần nào, và thiếu hẳn ô cho host không kết nối được (mục g).
  3. Bản plan đầu cho nhóm 4 **không chạy** với `live_crawl`, làm hàm ý Việc tiếp theo biến mất không dấu vết. Phiên validation bắt được (mục e).

## Đội đã verify bằng cách nào

**Không phải "đọc thấy hợp lý".** Từng dòng dưới đây là một lần chạy.

| Khẳng định | Verify bằng |
| --- | --- |
| `observations` không cần grant mới | `0003_grants_ai_tables.sql` — `GRANT SELECT, INSERT ON observations` là **table-level** ⇒ cột mới tự có |
| AI không bật được công tắc nguồn của chính nó | `0001_grants.sql:38` — `crm_system` chỉ có `GRANT SELECT ON companies`. Đo bằng `live-source-columns-and-grants.test.ts` nối **đúng vai** `DATABASE_URL_TEST_SYSTEM` |
| AI không ghi được vào `company_sources` | `0001_grants.sql:13` — `crm_system` cố ý **không** có `ALTER DEFAULT PRIVILEGES` ⇒ bảng mới bị cấm tới khi grant tay. Đo bằng cùng file test: INSERT/UPDATE/DELETE đều permission denied |
| **[Bị thay bởi [ADR-0037](0037-ung-vien-luu-o-bang-ai-khong-doc-duoc-va-cong-tac-tat-nguon.md)]** ~~Ứng viên không được persist~~ → **Ứng viên persist ở bảng AI không đọc được; danh sách đọc vẫn 0 hàng sau khi tìm** | `company-source-candidates.test.ts` test 1 — chạy xong `findCandidates`, `company_source_candidates` có **N** hàng và `company_sources` vẫn = **0**. Nửa sau của assertion **không đổi một chữ**, và đó là nửa mang tải |
| Bộ nghiệm thu bất khả xâm phạm | Chạy **đủ 39 e2e với `OBSERVATION_SOURCE=live_crawl`** → 39 xanh, và truy vấn CSDL sau đó: **mọi** bản lưu là `demo_snapshot`, crawler gọi **0** lần |
| Cửa gác SSRF chặn thật | Chạy tay qua sản phẩm: `http://169.254.169.254/latest/meta-data/` → `blocked_url`, không có gói tin nào ra |
| Bảng lỗi phân loại đúng | Chạy tay qua sản phẩm: tên miền không tồn tại → `unreachable`; `example.com/khong-co-trang-nay-404` → `http_4xx`; `example.com` → đọc được, 145 ký tự text, `source_kind = live_crawl` |
| Test có răng | Đảo 4 chỗ trong code sản phẩm (bỏ dải link-local · chỉ hỏi cửa gác ở hop đầu · bỏ dòng đếm byte · bỏ nhánh `js_required`) → **đúng 4 test đỏ, không lệch cái nào**, rồi khôi phục |
| Không test nào gọi internet | Chạy 99 test của `src/ai/` trong network namespace chỉ có loopback (`unshare -rn`) → 99 xanh, `curl` ra ngoài chết |
| Ba bẫy `web_search` | `anthropic-source-discovery.test.ts` 17 assertion với transport kịch bản: `pause_turn` nối tiếp đúng cách và có trần, `content` là object lỗi không throw, URL bịa bị bỏ |

**Chưa verify được:** hình dạng thật của khối `web_search_tool_result` — lấy từ tài liệu, chưa có `ANTHROPIC_API_KEY` để chạy một lượt thật. Parser viết phòng thủ (kiểm `Array.isArray` trước khi index, bỏ qua khối lạ), nhưng đây là chỗ **khai thẳng là chưa chạy**, không phải chỗ đã chứng minh.

## Rollback

Ba mức, từ rẻ tới đắt:

1. **Tắt bằng biến môi trường:** `OBSERVATION_SOURCE=` (trống) → mọi công ty về bản chụp. Hiệu lực sau một lần khởi động lại, ~30 giây. Dữ liệu đã sinh giữ nguyên.
2. **Tắt theo công ty:** `live_source_enabled = false`. Tức thì, không cần khởi động lại.
3. **Gỡ hẳn:** `git revert` ba commit của P2–P3 + một migration hạ cấp bỏ `unreachable` khỏi CHECK. ~15 phút. Migration `0008`/`0009` chỉ **cộng thêm** (2 cột có default, 1 cột default `false`, 1 bảng mới, 1 dòng GRANT) nên không có dữ liệu nào mất khi lùi.
