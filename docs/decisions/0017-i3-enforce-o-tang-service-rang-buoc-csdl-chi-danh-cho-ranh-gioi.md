# ADR-0017 — I-3 enforce ở tầng service, không dùng `UNIQUE`; ràng buộc CSDL chỉ dành cho ranh giới, luật hành vi thuộc service

| | |
| --- | --- |
| **Ngày** | 2026-08-13 01:27 |
| **Giai đoạn** | Design (mô hình dữ liệu, nhóm 2 + nhóm 5) |
| **Trạng thái** | Chấp nhận |
| **Người quyết định** | HungLV |
| **Prompt log** | phiên brainstorm phase 1 ngày 13/08 01:27 — [báo cáo](../../plans/reports/from-brainstorm-to-planner-260813-0127-phase-01-grant-insert-theo-cot-va-ba-quyet-dinh-report.md) |

## Bối cảnh

[ADR-0003](0003-chi-tao-ban-luu-khi-noi-dung-thay-doi.md) và **I-3** phát biểu: *chỉ tạo `Observation` khi `content_hash` khác **bản gần nhất** của cùng công ty*. Trùng thì ghi "đã đọc, không đổi" vào `WatchCycleRun`, không tạo bản lưu, không gọi LLM.

Plan phase 1 lúc đầu định cài bằng `UNIQUE (company_id, content_hash)`, với lý do "rẻ hơn kiểm ở tầng ứng dụng". Nhưng `UNIQUE` toàn cục **chặn mạnh hơn** chữ của I-3: chuỗi **A → B → A** bị từ chối ở bước 3, dù nội dung A ở bước 3 khác bản gần nhất (B).

Chuỗi đó không phải giả thiết. **T-6 và T-8 đều yêu cầu đổi bản chụp trước ⇄ sau**, và [ADR-0013](0013-seed-theo-du-lieu-tu-dat-chap-nhan-migrate-khi-btc-giao-du-lieu.md) + I-14 dựng seed thành đúng hai bản chụp để giám khảo diễn lại kịch bản. Giám khảo đổi sang "sau" (chạy được), rồi đổi về "trước" để diễn lại lần hai → `UNIQUE` từ chối → **AI im lặng ngừng sinh đúng lúc đang bị chấm**, không banner, không dòng nhật ký nào giải thích. I-14 có nút seed lại, nhưng giám khảo không nhất thiết biết phải bấm nó.

## Phương án đã cân nhắc

Tiêu chí: *(1)* khớp chữ của I-3 · *(2)* hành vi khi giám khảo diễn lại kịch bản · *(3)* có lớp chặn thứ hai hay không · *(4)* chi phí.

| Phương án | Ưu | Nhược | Kết luận |
| --- | --- | --- | --- |
| **A.** So `content_hash` với **bản gần nhất** ở tầng service; index `(company_id, captured_at DESC)`, **không** `UNIQUE` | Đúng đúng chữ I-3. Toggle trước/sau bao nhiêu lần cũng chạy → giám khảo diễn lại được vô hạn. Nhánh "trùng → ghi *đã đọc, không đổi*" là **hành vi phải test** chứ không phải lỗi phải bắt | I-3 không có backstop CSDL. Nếu service quên kiểm thì bản lưu trùng lọt vào | ✅ **Chọn** |
| **B.** `UNIQUE (company_id, content_hash)` | Có backstop CSDL, một dòng SQL | Chặn A→B→A. **Demo lặp lại chết im lặng** — dạng lỗi tệ nhất trong bối cảnh đang bị chấm. Và service *vẫn* phải kiểm trước để tránh gọi LLM vô ích, nên "rẻ hơn kiểm ở tầng ứng dụng" là sai: nó **không** thay được kiểm ở service, chỉ thêm vào | ❌ Loại — tiêu chí (1) và (2) |
| **C.** `UNIQUE` + `ON CONFLICT DO NOTHING`, xung đột thì ghi "đã đọc, không đổi" | Không bao giờ crash | Vẫn chặn A→B→A, chỉ chết êm hơn. Tệ hơn B ở một điểm: nhật ký ghi *"không đổi"* trong khi nội dung **rõ ràng đã đổi** → giám khảo đọc log thấy hệ thống nói sai về chính nó. Khó bảo vệ ở vòng 2 hơn cả một cái crash | ❌ Loại — đổi một lỗi nhìn thấy được thành một dòng log nói dối |

## Quyết định

Chọn **A**, và chốt luôn nguyên tắc tổng quát mà nó suy ra — phần này quan trọng hơn bản thân I-3:

> **Ràng buộc CSDL dành cho ranh giới mà Specs kiểm bằng SQL thẳng. Luật hành vi enforce ở service, và test ở service.**

Phân loại theo nguyên tắc đó, áp cho phase 1:

| Bất biến | Lớp enforce | Vì sao |
| --- | --- | --- |
| I-1 (`quote_text` không rỗng) | **CSDL** `NOT NULL` + `CHECK` | T-2 ghi rõ *"thử ghi thẳng, phải bị từ chối"* — Specs kiểm ngoài giao diện |
| I-11 (whitelist `target_field`) | **CSDL** `CHECK` | Ranh giới: sửa `company_type` tạo vòng lặp tự tham chiếu, không được lọt bằng bất kỳ đường nào |
| Vùng cấm tuyệt đối (giai đoạn, tiền, xoá) | **CSDL** quyền cột | T-10 gọi ngoài giao diện |
| Vùng 2/3/4 không ghi cột của người | **CSDL** quyền cột theo [ADR-0015](0015-grant-insert-phai-theo-cot-khi-bang-co-cot-thuoc-quyet-dinh-cua-nguoi.md) | Như trên |
| **I-3 (chỉ tạo bản lưu khi nội dung đổi)** | **Service** | Không phải ranh giới an toàn. Sinh trùng một bản lưu **không làm hại dữ liệu của người** — nó chỉ tốn tiền LLM và làm bẩn dòng thời gian, và cả hai thứ đó đo được ở nhật ký vòng quét |
| I-5, I-6, I-7, I-9, I-10 | **Service** | Cùng lý do: luật hành vi, phụ thuộc ngữ cảnh nhiều bảng, không phát biểu được thành ràng buộc một bảng |

Cài đặt:

```sql
CREATE INDEX ON observations (company_id, captured_at DESC);   -- không UNIQUE
```

```ts
const latest = await getLatestObservation(companyId)
if (latest?.contentHash === hash) {
  await watchCycle.record({ newContentCount: 0, note: 'da_doc_khong_doi' })
  return null                          // không tạo Observation, KHÔNG gọi LLM
}
```

## Hệ quả

- **Giám khảo toggle bản chụp bao nhiêu lần cũng chạy.** Đây là lý do chính, và nó là lý do sản phẩm chứ không phải lý do kỹ thuật.
- I-3 phải có **test ở tầng service**, không phải test ràng buộc: gọi ingest hai lần cùng nội dung → lần hai trả `null`, `WatchCycleRun` có dòng `da_doc_khong_doi`, **và số lần gọi `ClaimExtractor` vẫn là 1**. Khẳng định cuối là quan trọng nhất — nó là thứ chứng minh "không gọi LLM", tức là phần đắt tiền của I-3.
- Test I-3 phải có ca **A → B → A** trả về `Observation` mới ở bước 3. Không có ca này thì phương án B lẻn lại vào bất cứ lúc nào mà không ai biết.
- Nhánh "trùng" trở thành hành vi có tên (`da_doc_khong_doi`) hiện trên Nhật ký vòng quét → giám khảo phân biệt được "hệ thống đã quét và nội dung không đổi" với "hệ thống chết", đúng tinh thần I-10.
- **Sẽ phải xem lại nếu:** xuất hiện đường ghi `Observation` thứ hai không đi qua service (ví dụ script import dữ liệu BTC ghi thẳng). Lúc đó service không còn là điểm duy nhất, và phải hoặc bắt script đi qua service, hoặc chấp nhận `UNIQUE` cộng với việc bỏ luôn kịch bản toggle-về-trước.

## AI đã tham gia thế nào

- **Vai trò AI:** đọc chéo I-3 với T-6/T-8 và phát hiện `UNIQUE` mâu thuẫn với kịch bản demo — chỗ mà bản plan trước đó (cũng do AI viết) không nối lại.
- **AI sai ở đâu:** bản phase-01 đầu tiên do AI viết ghi *"`observations` unique `(company_id, content_hash)` → I-3 **rẻ hơn** kiểm ở tầng ứng dụng"*. Câu đó sai hai lần: *(a)* nó không rẻ hơn vì service **vẫn** phải kiểm trước để khỏi gọi LLM — `UNIQUE` chỉ chặn sau khi đã tốn tiền; *(b)* nó chặn nhiều hơn I-3 yêu cầu, và chỗ chặn thừa đúng là kịch bản demo. AI nhìn "unique" như một cách rẻ để enforce, không nhìn nó như một cách đổi hành vi.
- **AI đề xuất gì mà đội không nghe:** phương án C (`UNIQUE` + `ON CONFLICT DO NOTHING`) được AI nêu như đường trung dung "vừa có backstop vừa không crash". Bỏ vì nó làm nhật ký ghi *"không đổi"* khi nội dung đã đổi — hệ thống nói sai về chính nó, thứ khó bảo vệ ở vòng 2 hơn cả một cái crash.

## Đội đã verify bằng cách nào

- **Đọc chéo tài liệu nghiệp vụ, đối chiếu chữ với chữ:** I-3 nói "khác **bản gần nhất**"; `UNIQUE (company_id, content_hash)` nói "khác **mọi bản đã từng có**". Hai phát biểu khác nhau, và chỗ khác nhau là tập chuỗi có dạng A→…→A. Đây là suy luận trên văn bản, kiểm được bằng cách đọc lại, không cần chạy.
- **Truy ra kịch bản cụ thể bị ảnh hưởng, không dừng ở "về lý thuyết có thể":** T-6 (*"đổi bản chụp sang bản sau"*) + T-8 (*"đổi nguồn 2 công ty"*) + seed hai bản chụp của ADR-0013 → chuỗi A→B→A xuất hiện ngay lần thứ hai giám khảo diễn lại. Đây là điều kiện chuyển từ "rủi ro giả thiết" sang "sẽ xảy ra".
- **Đo bằng test, ở P2:** ba khẳng định — *(1)* ingest hai lần cùng nội dung → lần hai `null` + `da_doc_khong_doi` + `ClaimExtractor` được gọi đúng 1 lần; *(2)* chuỗi A→B→A → bước 3 tạo được `Observation` mới; *(3)* phép đo đột biến: xoá nhánh so-với-bản-gần-nhất trong service → khẳng định (1) phải đỏ.

## Rollback

Thêm `UNIQUE (company_id, content_hash)` bằng một migration nếu hoá ra bản lưu trùng thực sự tràn vào: **~10'**. Nhưng đi kèm điều kiện bắt buộc — phải **bỏ kịch bản toggle-về-bản-trước khỏi bài demo** và nói trước với giám khảo cách seed lại, nếu không thì rollback này mua một lớp chặn cho luật hành vi bằng cách đánh đổi một điểm nghiệm thu.
