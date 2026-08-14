---
phase: 2
title: "Đọc một nguồn thật — SSRF, timeout, phân loại lỗi"
status: done
priority: P1
dependencies: [1]
---

# Phase 2: Đọc một nguồn thật — SSRF, timeout, phân loại lỗi

## Overview

Mở vòi. Sau phase này sản phẩm **đọc thật** một trang web công khai cho công ty ngoài seed, ghi thành `Observation` mà mình sở hữu từng byte, và `ClaimExtractor` hiện tại rút phát hiện qua đúng cửa I-2 không sửa gì.

**Đây là điểm dừng sạch nhất của cả plan.** Xong phase này là demo vòng 3 có khoảnh khắc đọc thật: thêm một công ty thật trên sân khấu, bật công tắc, dán URL, bấm đọc, ra phát hiện có câu trích bấm được về nguồn.

## Requirements

**Chức năng**
- `LiveCrawlSource.read(url)` trả `{ sourceUrl, rawHtml }` hoặc một lý do lỗi thuộc danh sách đóng.
- Chặn SSRF **trước khi phát request**: chỉ `http`/`https`; từ chối private / loopback / link-local / IPv6 tương ứng.
- Timeout 8s; cắt nội dung ~512KB; **không retry, không backoff** (ngoài phạm vi — đã khai ở prompt log).
- Mỗi loại lỗi → đúng một `fetch_error_reason`; bản lưu hỏng sinh **0 `Claim`**.
- Vùng đọc phân biệt **bằng mắt**: loại nguồn · cấp nguồn · lý do đọc hỏng bằng tiếng Việt.

**Phi chức năng**
- **Không test nào gọi internet.** `assertPublicUrl` là hàm thuần; `fetchPage` test với http server cục bộ.
- Không sửa `ClaimExtractor` / `ClaimService` / `normalizeSnapshotText`.

## Architecture

### Tách ba mảnh — vì cửa gác chặn chính test của nó

Đây là điểm thiết kế duy nhất không hiển nhiên của phase này. Test tích hợp cần fetch `127.0.0.1`, mà cửa gác SSRF **chặn loopback**. Nếu ghép cửa gác vào trong hàm fetch thì test buộc phải gọi internet thật — và test gọi internet thật là test hỏng.

```
assertPublicUrl(url)   -- hàm thuần, không I/O.        Test: bảng IP/scheme
      │                    Throws BlockedUrlError.
fetchPage(url, opts)   -- I/O thuần, KHÔNG gọi cửa gác. Test: http server cục bộ
      │                    Trả { ok, html } | { failed, reason }
LiveCrawlSource        -- ghép hai cái, đọc env.        Test: mock hai mảnh
```

`LiveCrawlSource` là chỗ duy nhất biết cả hai. Nó cũng là port thay thế `DemoSnapshotSource` — mà `demo-snapshots.ts:240-244` đã dự tính sẵn: *"a future real crawler can be swapped in without touching the service."*

### Bảng phân loại lỗi

| Tình huống | `fetch_error_reason` | Nhãn Sales đọc |
| --- | --- | --- |
| Quá 8s | `timeout` | Trang không phản hồi kịp |
| 401/403/404/429… | `http_4xx` | Trang từ chối máy đọc tự động |
| 5xx | `http_5xx` | Máy chủ của trang đang lỗi |
| Vòng chuyển hướng / quá số hop | `redirect_loop` | Trang chuyển hướng vòng quanh |
| **Normalize xong ra text rỗng** | `js_required` | Trang cần chạy JavaScript mới hiện nội dung |
| `content-type` không phải HTML/text | `not_html` | Nguồn không phải trang web đọc được |
| Quá ~512KB | `too_large` | Trang quá lớn để đọc an toàn |
| Cửa gác SSRF chặn | `blocked_url` | Địa chỉ không được phép đọc |
| URL không parse được / thiếu | `invalid_url` | Địa chỉ nguồn không hợp lệ |
| **Không phân giải được tên miền / kết nối bị từ chối / TLS hỏng** | `unreachable` | Không kết nối được tới trang |

> **Dòng cuối thêm lúc thi công (D5), không có trong bản plan.** Chín giá trị đầu được chốt trước khi có dòng code nào mở socket và **không có ô nào** cho một tên miền không phân giải được. Hai ô gần nhất đều nói sai với người đọc: `timeout` là "Trang không phản hồi kịp" trong khi kết nối bị từ chối sau 3ms, còn `invalid_url` bảo Sales đi sửa một địa chỉ đúng mà chỉ đang chết. Migration `0009` mở rộng `CHECK` — chỉ cộng thêm.

`js_required` là giá trị **đắt nhất** của bảng này: nó chính là thứ phân biệt *"không đọc được vì lỗi"* với *"nguồn thật sự không có gì"* — đúng câu Sales Manager chất vấn ở [prompt log mục 2](../../docs/ai-sessions/260814-1124-req-crawl-web-that.md).

### URL đọc ở đâu (P2)

Phase này lấy URL từ **`companies.website`** — cột đã có, Sales đã gõ khi tạo công ty. `website` trống → `fetch_error_reason='invalid_url'`, ghi trung thực, không đoán.

P3 sẽ chuyển nguồn URL sang `company_sources`; `ObservationService` viết sao cho nó **đọc một danh sách URL** ngay từ P2 (danh sách một phần tử), để P3 không phải sửa lại vòng lặp.

### Giao diện

`reading-zone.tsx` thêm ba thứ, theo [design-guidelines](../../docs/design-guidelines.md) — **tím = máy sinh ra**, và loại nguồn phải phân biệt được bằng mắt (luật 2 áp cho cả loại nguồn, không chỉ fact/suy luận):

1. Nhãn loại nguồn: *Bản chụp* / *Nguồn thật*.
2. Nhãn cấp nguồn: *Trang công ty* / *Tin tức* / *Mạng xã hội*.
3. Với bản lưu hỏng: **lý do bằng tiếng Việt**, không phơi mã HTTP thô. Một trang bị chặn phải đọc lên thành **thông tin**, không phải **sản phẩm lỗi** — đây là hệ quả trực tiếp của quyết định "cho mạng xã hội vào để hỏng trung thực".

Không dùng màu thô Tailwind; dùng `ink-*` / `brand-*` / `machine-*` + bốn màu trạng thái. Vùng chạm ≥44px.

## Related Code Files

**Create**
- `apps/api/src/ai/assert-public-url.ts`
- `apps/api/src/ai/fetch-page.ts`
- `apps/api/src/ai/live-crawl-source.ts`
- `apps/api/src/ai/observation-source.provider.ts`
- `apps/api/src/ai/__tests__/assert-public-url.test.ts`
- `apps/api/src/ai/__tests__/fetch-page.test.ts`
- `apps/api/src/ai/__tests__/live-crawl-source.test.ts`

**Modify**
- `apps/api/src/domain/observation/observation-service.ts` (vòng lặp theo danh sách URL, ghi `fetch_error_reason`)
- `packages/contracts/src/dto/*` (thêm `sourceKind`, `fetchErrorReason` vào `ObservationDto`)
- `apps/web/src/components/provenance/reading-zone.tsx`
- `e2e/reading-zone-provenance.spec.ts` (thêm assert nhãn nguồn — **không** đổi assert cũ)
- `.env.example` (`OBSERVATION_SOURCE`, kèm cảnh báo mặc định tắt)

## Implementation Steps

### Bước 0 — test trước, phải thấy đỏ

1. `assert-public-url.test.ts` — bảng, **không I/O**:
   - Chặn: `http://127.0.0.1`, `http://localhost`, `http://10.0.0.1`, `http://172.16.0.1`, `http://192.168.1.1`, `http://169.254.169.254`, `http://[::1]`, `http://[fd00::1]`, `http://0.0.0.0`
   - Chặn scheme: `file://`, `ftp://`, `gopher://`, `data:`, `javascript:`
   - Cho qua: `https://example.com`, `http://example.com:8080/a?b=c`
   - Chặn cả dạng đã encode / có credentials (`http://user:pass@127.0.0.1`)
2. `fetch-page.test.ts` — http server cục bộ trong test, **một case một hành vi**: 200 HTML ok · 200 rỗng → text rỗng · 403 · 500 · chuỗi redirect quá hop · `content-type: application/pdf` · body lớn hơn ngưỡng · server không trả gì trong > timeout.
3. `live-crawl-source.test.ts` — ghép: URL bị cửa gác chặn → `blocked_url` **và `fetchPage` không được gọi** (spy đếm 0 — nếu request đã bay ra thì cửa gác vô nghĩa). Normalize ra rỗng → `js_required`.
4. Bổ sung vào test tích hợp của `ObservationService`: bản lưu `fetch_status='failed'` → **0 `Claim`**, và `fetch_error_reason` đúng giá trị.

Chạy `pnpm test:unit`, thấy đỏ. Rồi mới code.

### Bước 1 — ba mảnh, cộng việc P1 đẩy sang

`assertPublicUrl` → `fetchPage` → `LiveCrawlSource`. Provider chọn nguồn theo `resolveObservationSource` của P1, **log lúc boot**.

**Hai việc P1 cố ý để lại (xem [phase-01 mục Đã chạy](./phase-01-cua-gac-co-test.md#đã-chạy--1408) D3):**

1. **Nối `resolveObservationSource` vào `ObservationService`.** P1 ghi thẳng `sourceKind: 'demo_snapshot'` vì phân giải sang `live_crawl` khi chưa có crawler sẽ dán nhãn nội dung bản chụp là "đọc thật" — nói dối ở đúng cột trần tự chủ tính từ đó. Đây là chỗ I-17 chuyển từ "có test hàm thuần" sang "có trên đường chạy".
2. **Test tiêu chí bất khả xâm phạm của bộ nghiệm thu.** `OBSERVATION_SOURCE=live_crawl` + đọc công ty seed → `source_kind='demo_snapshot'` **và spy của `LiveCrawlSource` đếm 0**. P1 không viết test này: khi chưa có crawler thì nó xanh vì tính năng chưa tồn tại, đúng loại "test không đo gì" mà plan cấm. Viết ngay sau khi crawler có thật.

### Bước 2 — vòng lặp theo danh sách URL

`ObservationService.ingest`: với `live_crawl`, lặp qua danh sách URL (P2: một phần tử từ `companies.website`), mỗi URL một bản lưu, I-3 so theo `(company_id, source_url)`. Một URL hỏng **không** làm hỏng các URL còn lại — tổng hợp kết quả rồi trả về, đúng tinh thần try/catch của `claim-reaction-service.ts:96-108`.

### Bước 3 — giao diện

Ba nhãn ở mục Architecture. Chạy checklist mục 7 design-guidelines. Thêm assert e2e, **không đổi accessible name nào đang có** (39 e2e đang chọn phần tử bằng accessible name).

### Bước 4 — xanh lại + demo thử tay

`pnpm test` đủ bộ. Rồi **thử thật một lần bằng tay**: tạo công ty với website thật, bật công tắc, bấm đọc, xem có phát hiện kèm câu trích bấm ra được nguồn. Nếu `ANTHROPIC_API_KEY` trống thì chờ đợi đúng: **0 phát hiện**, và đó là suy giảm trung thực chứ không phải lỗi.

Commit. **Đây là điểm dừng an toàn** — quyết định có làm P3 hay không tại đây, xem [mốc cắt cứng](./plan.md#mốc-cắt-cứng).

## Success Criteria

- [ ] Mọi test ở Bước 0 **đã từng đỏ**, giờ xanh
- [ ] URL private/loopback/link-local/scheme lạ → `blocked_url`, và **`fetchPage` được gọi 0 lần**
- [ ] Chín loại lỗi ra đúng chín giá trị `fetch_error_reason`
- [ ] Bản lưu `failed` → **0 `Claim`**
- [ ] Đọc thật một trang công khai → có `Observation` với `source_kind='live_crawl'`, `raw_content` không rỗng, và (khi có `ANTHROPIC_API_KEY`) có `Claim` với câu trích **là chuỗi con nguyên văn** của `raw_content`
- [ ] Một URL hỏng không làm hỏng URL khác trong cùng lượt đọc
- [ ] Vùng đọc phân biệt được loại nguồn / cấp nguồn / lý do hỏng bằng mắt; qua checklist mục 7
- [ ] `pnpm test` đủ bộ xanh, gồm T-1…T-10; **không** test nào gọi mạng
- [ ] `.env.example` khai `OBSERVATION_SOURCE` kèm cảnh báo mặc định tắt

## Đã chạy — 14/08

**Xanh. 414 unit test (baseline P1 337, cộng đúng 77 test mới), 0 hồi quy.** 39 e2e xanh, `docker compose build` xanh. `typecheck` · `lint` sạch cả 4 project.

| Test mới | Số assertion | Đo gì |
| --- | --- | --- |
| `apps/api/src/ai/__tests__/assert-public-url.test.ts` | 42 | Bảng chặn: 20 dạng địa chỉ nội bộ · **5 cách viết loopback** (thập phân, bát phân, hex, rút gọn, percent-encode) · 5 scheme lạ · 3 ca thông tin đăng nhập · 4 ca không phân tích được |
| `apps/api/src/ai/__tests__/fetch-page.test.ts` | 14 | Http server cục bộ: 200 · 200 rỗng · 403/404/500 · chuỗi chuyển hướng trong và ngoài hạn mức · **cửa gác được hỏi lại ở từng hop** · không phải HTML · quá cỡ theo header **và** theo dòng byte · treo quá hạn · cổng đóng · chuỗi không phải URL |
| `apps/api/src/ai/__tests__/live-crawl-source.test.ts` | 11 | Thứ tự cửa gác trước request (**`fetchPage` đếm 0**) · URL sau chuyển hướng là URL được lưu · normalize rỗng → `js_required` · 7 lý do đi xuyên không bị dán nhãn lại |
| `apps/api/src/domain/observation/__tests__/live-crawl-ingest.test.ts` | 10 | **Bộ nghiệm thu bất khả xâm phạm**: công ty seed + `OBSERVATION_SOURCE=live_crawl` → `demo_snapshot` và crawler đếm **0** · đường đọc thật ghi đúng `source_kind` · I-3 theo URL trên nhánh thật · 3 loại lỗi → 0 `Claim` · website trống → `invalid_url` · công tắc tắt và biến môi trường trống đều đóng đường |

Kiểm chứng test có răng: đảo bốn chỗ trong code sản phẩm (bỏ dải link-local · chỉ hỏi cửa gác ở hop đầu · bỏ dòng đếm byte · bỏ nhánh `js_required`) → **đúng 4 test đỏ, không lệch cái nào**, rồi khôi phục.

### Bốn chỗ làm khác plan, và lý do

| | Chỗ lệch | Lý do |
| --- | --- | --- |
| **D5** | Bảng lỗi có **mười** giá trị, không phải chín. Thêm `unreachable` + migration `0009` | Danh sách chín được chốt trước khi có dòng code nào mở socket, và nó **không có ô nào** cho DNS không phân giải / kết nối bị từ chối / bắt tay TLS hỏng. Hai ô gần nhất đều nói sai: `timeout` là "Trang không phản hồi kịp" trong khi kết nối bị từ chối sau 3ms, `invalid_url` bảo người ta đi sửa một địa chỉ đúng mà chỉ đang chết. Luật 4 — một dòng sai tệ hơn một dòng trống. Migration chỉ thay `CHECK`, không đụng dữ liệu |
| **D6** | `fetchPage` **có** gọi cửa gác — nhận `assertAllowed` là tham số **bắt buộc** và hỏi lại ở **từng hop chuyển hướng** | Bản plan để `fetchPage` không gọi cửa gác chút nào, để test dùng được `127.0.0.1`. Nhưng thế thì một URL công khai 302 sang `169.254.169.254` đi lọt — đúng bài SSRF sách giáo khoa. Cách giữ cả hai: cửa gác vẫn là hàm thuần và vẫn được truyền vào, nhưng **bắt buộc**, nên việc bỏ qua nó là một dòng nhìn thấy được trong file test (`ALLOW_LOOPBACK`) chứ không phải thứ code sản phẩm quên được. Vì vậy chuyển hướng đi theo tay, không dùng `redirect: 'follow'` — bản dựng sẵn không có chỗ nào để hỏi |
| **D7** | `IngestResultDto` thêm `sourcesAttempted` · `sourcesFailed` | Một `fetchStatus` đủ khi mỗi công ty có đúng một nguồn. Nó **không nói được** "2 trong 3 trang trả lời", và làm tròn thành `ok` sẽ giấu một nguồn chết cả tuần sau một kết quả xanh. Chỉ **thêm** field, không đổi nghĩa field nào đang có, nên giao diện và e2e cũ không phải sửa |
| **D8** | Test cũ nhận `liveSourceThatMustNotRun()` — một `LiveCrawlSource` **ném lỗi nếu bị chạm** | `ObservationService` có tham số thứ 8. Đưa cho test cũ một reader chạy được thì câu "test này có đọc mạng không" thành thứ phải suy luận; đưa reader nổ thì nó thành một assertion đỏ có stack trace. T-1…T-10 chạy trên công ty seed, mà I-16 nói seed không bao giờ được crawl, nên số lần đọc thật đúng của mọi test đó là **0** |

### Chưa làm được ở P2, nói thẳng

- **"Một URL hỏng không làm hỏng URL khác"** — vòng lặp và phần tổng hợp đã có và đã test cho ca một nguồn, nhưng **chưa chứng minh được** vì danh sách URL của P2 luôn đúng một phần tử (`companies.website`). Ca thật xuất hiện ở P3 cùng `company_sources`; tiêu chí này chuyển sang P3.
- **Chống DNS rebinding** ngoài phạm vi: cửa gác là hàm thuần nên không phân giải tên miền, một hostname công khai trỏ về `127.0.0.1` vẫn lọt. Đã ghi thẳng giới hạn này trong `assert-public-url.ts`. Đóng nó cần kiểm địa chỉ đã phân giải lúc kết nối — là I/O, và thuộc `fetchPage`. Rủi ro còn lại bị chặn bởi chính hình dạng tính năng: một cú fetch tới địa chỉ do người đăng nhập tự chọn cho công ty của họ, và kết quả chỉ đi vào hàng đợi duyệt (I-15).

## Risk Assessment

| Rủi ro | Đối sách |
| --- | --- |
| Cửa gác SSRF chặn chính test của nó | Đã tách ba mảnh (mục Architecture). Nếu vẫn vướng thì test `fetchPage` với server cục bộ + inject một `resolve` giả, **không** nới cửa gác |
| Trang thật quá bẩn, `normalizeSnapshotText` ra rác | `normalizeSnapshotText` vốn được viết cho HTML "cố ý bẩn" (`demo-snapshots.ts:16-18`). Nếu ra text rỗng thì đã có `js_required`. Rác không rỗng thì cửa I-2 lọc: câu trích không khớp ⇒ `Claim` bị bỏ và **được đếm** |
| Trang thật rất lớn ⇒ chi phí LLM tăng | Cắt ~512KB trước khi normalize, và cắt lần hai theo độ dài text trước khi gửi extractor |
| `fetch` của Node bị chặn bởi proxy công ty | Thử tay ở Bước 4 phát hiện ngay. Nếu bị chặn: đây là lúc dừng ở P1 và khai thẳng, không giả lập |
| Đổi `ObservationDto` làm đỏ e2e cũ | Chỉ **thêm** field, không đổi/xoá. Không đổi accessible name |
| Demo cần internet lúc trình bày | Mặc định tắt; `OBSERVATION_SOURCE=snapshot` là quay về trạng thái hôm nay trong một biến môi trường |
