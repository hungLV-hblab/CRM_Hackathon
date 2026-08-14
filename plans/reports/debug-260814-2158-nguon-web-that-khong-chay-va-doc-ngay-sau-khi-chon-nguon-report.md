# Debug — vì sao HBLAB vẫn ghi `fetch_status=failed` mỗi vòng quét, và đọc ngay sau khi chọn nguồn

Ngày: 2026-08-14 · Nhánh: `master` · Công ty điều tra: `5faf5144-3fc2-4733-bd78-05b9ab4a8d8b` (HBLAB)

## Tóm tắt

Hai việc, hai nguyên nhân khác nhau:

1. **Log lỗi mỗi vòng quét** — **không phải bug code, là thiếu cấu hình.** `.env` không có dòng
   `OBSERVATION_SOURCE`, nên toàn hệ thống chạy nhánh bản chụp. Công tắc "Bật nguồn thật" của HBLAB
   và 2 URL đã lưu bị bỏ qua hoàn toàn. Đã sửa, đã xác minh chạy thật.
2. **Chọn nguồn xong phải chờ vòng quét** — đúng, trước đây `POST /sources` chỉ ghi URL rồi thôi.
   Đã nối thêm một lần đọc ngay sau khi lưu.

## 1 · Nguyên nhân gốc của cảnh báo

Bằng chứng, không suy đoán:

| Bước | Bằng chứng |
| --- | --- |
| Từ khoá `unknown` chỉ sinh ở **một** chỗ | `observation-service.ts:185` — nhánh `demo_snapshot`, khi công ty không có bản chụp. Nhánh live không bao giờ sinh chuỗi này |
| Worker đang chạy nhánh nào | Log boot: `OBSERVATION_SOURCE=trống → chỉ đọc bản chụp` |
| Biến môi trường thật trong container | `printenv OBSERVATION_SOURCE` → rỗng |
| `.env` | `grep -c "^OBSERVATION_SOURCE" .env` → **0** |
| Trạng thái công ty trong CSDL | `is_watched=t`, `live_source_enabled=t`, **2** URL trong `company_sources` — tức phía người dùng đã làm đúng hết |
| Hậu quả tích luỹ | 22 bản lưu `unknown / failed / demo_snapshot`, mỗi vòng quét thêm 1 |

Chuỗi nhân quả:

```
.env thiếu OBSERVATION_SOURCE
  → resolveObservationSource() trả 'demo_snapshot' ngay ở dòng 53
     (chặn TRƯỚC khi kịp đọc liveSourceEnabled ở dòng 64)
  → collectReads() đi nhánh bản chụp
  → DemoSnapshotSource.read(HBLAB) → không có (HBLAB không thuộc bộ seed)
  → sourceUrl = 'unknown', rawHtml = null
  → recordUnreadableSource() ghi fetch_status=failed  ← dòng WARN bạn thấy
```

Điểm đáng chú ý: `resolve-observation-source.ts` **cố ý** xếp thứ tự nhánh như vậy (comment dòng
10–13: "mọi early return đều rơi về phía an toàn"). Cấu hình sai chỉ có thể làm **mất** đường live,
không bao giờ mở nhầm. Hệ thống hành xử đúng thiết kế — chỉ là không ai nói cho nó biết được phép
đọc web thật.

### Đã sửa

`.env` (gitignored, không vào commit):

```
OBSERVATION_SOURCE=live_crawl
```

### Xác minh sau khi khởi động lại

| Kiểm tra | Kết quả |
| --- | --- |
| Log boot worker | `OBSERVATION_SOURCE=live_crawl → đọc trang web thật được BẬT` |
| Bản lưu của HBLAB | Cả **2** URL → `fetch_status=ok`, `source_kind=live_crawl` |
| Rút phát hiện | `Bản lưu 268786c2…: 7/10 phát hiện được lưu, 3 bỏ vì câu trích không khớp, 6 hạ mức Chắc` |
| Vòng quét | 4 công ty · 1 có nội dung mới · **0 lỗi** |
| Dòng `unknown/failed` | Dừng hẳn ở 15:09:58, không sinh thêm |
| `entries_added` | **0** — đúng I-15: phát hiện từ nguồn thật chỉ được vào hàng đợi duyệt |

Ba công ty seed vẫn `Đã đọc, không đổi` trên bản chụp — I-16 giữ nguyên, bộ nghiệm thu không bị động.

## 2 · Đọc ngay sau khi chọn nguồn

Trước: `POST /companies/:id/sources` chỉ INSERT rồi trả về. Muốn thấy kết quả phải chờ tới 60 giây.

Sau: lưu xong → gọi luôn `POST /companies/:id/observations`.

Đặt ở **tầng web**, không phải trong `CompanySourceService.save()`, vì:

- Đọc 2 nguồn tốn ~40 giây (2 lượt fetch + 2 lượt LLM). Nhét vào trong `save()` là bắt một request
  HTTP treo 40 giây, dễ timeout, và người bấm không thấy gì đang chạy.
- Đường ghi hiện tại không đổi một dòng nào. Không thêm hợp đồng mới, không thêm đường AI tự ghi.

Ba quyết định trong lúc nối:

| Quyết định | Lý do |
| --- | --- |
| `triggerContext: 'manual_ingest'` | **I-4** — người bấm nút thì phát hiện không được biến thành mục dòng thời gian. Mượn `watch_cycle` để lấy thêm quyền là tự mở vùng tự chủ 4 ngoài chỗ Specs cho phép |
| Chỉ chạy khi `liveSourceEnabled` bật | Danh sách nguồn **chỉ** được đọc ở nhánh live (`collectReads`). Công tắc tắt thì danh sách nằm im — đọc lúc đó là đọc bản chụp, kết quả chẳng liên quan gì tới thứ vừa lưu, mà lại còn đẻ thêm đúng loại dòng `unknown/failed` ở mục 1 |
| Mutation **riêng**, không gộp vào `save` | Hai việc hỏng độc lập nhau. URL đã nằm trong CSDL ngay khi `save` trả về; nếu lần đọc sau đó timeout mà hiện "không lưu được" thì đó là một dòng sai — luật 4 |

Giao diện: nút đổi chữ `Đang lưu…` → `Đã lưu — đang đọc nguồn…`, đọc xong hiện `IngestSummary`
(số phát hiện lưu/đề xuất/bỏ vì câu trích). Đọc hỏng thì báo rõ *"Đã lưu nguồn, nhưng chưa đọc được: …"*.

`IngestSummary` được tách ra `ingest-summary.tsx` vì giờ hai màn cùng báo cáo một lần đọc; để hai bản
sao thì bản nào lệch sẽ là bản quên nhắc số phát hiện bị bỏ.

### Xác minh

Gọi đúng request mà giao diện mới phát ra:

```
POST /api/companies/5faf…/observations  {"variant":"after","triggerContext":"manual_ingest"}
→ {"sourcesAttempted":2,"sourcesFailed":0,"unchanged":true,"systemEntriesAdded":0}
```

`sourcesAttempted:2` = đọc đúng 2 URL trong danh sách đã lưu. `unchanged:true` = nội dung trùng lần
vòng quét vừa đọc nên I-3 chặn, không tạo bản lưu thừa, không gọi LLM. `systemEntriesAdded:0` = I-15
và I-4 đều giữ.

## 3 · Cổng chất lượng

| Lệnh | Kết quả |
| --- | --- |
| `pnpm typecheck` | Xanh cả 4 package |
| `pnpm lint` | Xanh |
| `pnpm test:unit` | **447/447 xanh** (40 file) |

Trên đường chạy có gặp 2 vấn đề môi trường **có sẵn từ trước**, không do thay đổi này:

1. `dist` của `@crm/contracts` và `@crm/db` cũ hơn source → typecheck báo hàng loạt lỗi ở file không
   ai đụng tới. Sửa bằng `pnpm --filter @crm/contracts build && pnpm --filter @crm/db build`.
2. `.env` trỏ `DATABASE_URL_TEST*` vào `localhost:**5432**`, trong khi container publish **5403**
   (`.env.example` ghi đúng 5403). `pnpm test:unit` không chạy được dòng nào cho tới khi sửa. Đã sửa
   đúng số cổng trong `.env`, không đụng mật khẩu.

## 4 · Còn nợ / cần bạn quyết

1. **Chưa có test tự động cho phần nối ở giao diện.** `apps/web` hiện **không có** hạ tầng test
   component nào (không jsdom, không testing-library, 0 file test). Đủ ba lựa chọn, đều tốn:
   - thêm jsdom + @testing-library/react + project vitest cho web (đúng DoD, nhưng là dựng hạ tầng
     mới vào đêm freeze);
   - e2e Playwright, phải `page.route()` chặn lời gọi `source-candidates` (tốn tiền, 10–20 giây,
     kết quả không định trước) — nhưng chặn như vậy chạm luật "không mock, không fake data";
   - chấp nhận không có test, dựa vào typecheck + lần chạy thật ở mục 2.

   Tôi **không tự chọn** vì cả (b) và (c) đều đụng luật của đội. Phần logic mới đúng 4 dòng.

2. **22 bản lưu rác `unknown/failed`** của HBLAB vẫn nằm trong CSDL, giờ đã ngừng sinh thêm nhưng vẫn
   hiện trong Vùng đọc. Xoá được bằng một câu DELETE — **chưa xoá, chờ bạn đồng ý** vì đây là xoá dữ
   liệu.

3. **Lỗi tiềm ẩn còn nguyên (chưa sửa, cần ADR).** Bất kỳ công ty **ngoài seed** nào được bật *Đang
   theo dõi* mà **không** bật nguồn thật sẽ lặp lại y hệt: mỗi vòng quét một dòng
   `unknown/failed/demo_snapshot`, vô hạn. `recordUnreadableSource` cố ý bỏ qua I-3 (comment dòng
   383–386: một lần đọc hỏng thật thì không được giấu). Nhưng "công ty này chưa từng có nguồn nào để
   đọc" không phải sự cố tạm thời — nó vĩnh viễn, và ghi nó như một lần fetch hỏng là sai loại.
   Đề xuất: nhánh bản chụp không tìm thấy bản chụp thì trả `skippedReason` thay vì ghi bản lưu hỏng.
   Việc này đổi hành vi mà ontology 3.5 đang mô tả → cần ADR, chưa làm.

## File đã đổi

```
apps/web/src/app/(app)/cong-ty/[id]/ingest-summary.tsx           (mới — tách ra dùng chung)
apps/web/src/app/(app)/cong-ty/[id]/page.tsx                     (bỏ bản cục bộ, import)
apps/web/src/app/(app)/cong-ty/[id]/source-discovery-section.tsx (nối lần đọc sau khi lưu)
.env                                                             (không commit: OBSERVATION_SOURCE + cổng test)
```
