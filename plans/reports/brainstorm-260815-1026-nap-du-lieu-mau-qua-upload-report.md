# Brainstorm — Nạp dữ liệu mẫu BTC qua upload zip từ giao diện

| | |
|---|---|
| Ngày | 2026-08-15 10:26 |
| Input | `/home/trungmd/projects/ai-hackathon/hackathon-1-data.zip` (BTC phát sáng 15/08) |
| Yêu cầu gốc | Spec mục 7, điều kiện 5: nạp dữ liệu BTC qua UI upload zip, không gõ tay không sửa mã, nạp lại cùng file thì về đúng trạng thái ban đầu. Điều kiện tiên quyết cho mọi lượt chấm định kỳ |

## 1. Bối cảnh

Task ban đầu chỉ là "làm tính năng upload zip". Trong lúc scout, phát hiện kiến trúc hiện tại (seed hư cấu 5 công ty viết tay + bản chụp giới hạn 1 trang/công ty) không chở nổi hình dạng dữ liệu thật của BTC (25 công ty, 3-4 trang/công ty). Sau khi đối chiếu, người quyết định chốt: **bỏ hẳn mọi dữ liệu viết tay (kể cả seed dùng cho bộ test chấm điểm tự động), nguồn dữ liệu duy nhất của toàn hệ thống là file zip** — cả CLI (`pnpm seed`) lẫn tính năng upload trên giao diện đều gọi chung một hàm parse-zip-rồi-nạp, chỉ khác điểm vào (CLI đọc file zip checked-in repo, giao diện đọc file người dùng tải lên).

## 2. Dữ liệu mẫu — xác minh trực tiếp trên file, không suy đoán

| Mục | Số liệu thật | Ghi chú |
|---|---:|---|
| `Account.csv` | 25 công ty (`C15`-`C39`) | Cột `company_type`, `stage` khớp **chính xác 100%** nhãn tiếng Việt trong `packages/contracts/src/enums.ts` — reverse-lookup thẳng, không cần đổi ontology |
| `Contacts.csv` | 38 người | — |
| `Opps.csv` | 23 dòng, nhưng chỉ **15 dòng thật** | 8 dòng (`O1`-`O8`, `sales_owner=Demo`, `company_code` thuộc `C01/C02/C07/C08/C10/C12/C13`) **không tồn tại trong `Account.csv`** — mâu thuẫn thẳng với README của chính BTC ("O1–O8 không nằm trong file này", "không có mã mồ côi"). Importer **bắt buộc** lọc theo `company_code` hợp lệ, không tin README mù quáng |
| `snapshot/` | 172 file HTML thật | 24/25 công ty có bản chụp (C32 không có website → không có gì để đọc — case thật, không phải giả lập). 3-4 trang/công ty (homepage, news, company-profile, recruit...), **không phải 1 trang/công ty** như giả định hiện tại |
| `Snapshots.csv` (README có nhắc) | Không có trong file | Không chặn gì — `source_url`/`captured_at`/`news_type`/`key_quote` không được code nào đọc (đã grep xác nhận); tự dựng `source_url` từ `website_url` + tên file là đủ |

### Độ phủ kịch bản T-1..T-10 bằng 15 cơ hội thật (đã kiểm, không phải áng chừng)

- 3 cơ hội mở thiếu Việc tiếp theo/ngày hạn sẵn (`O18`, `O19`, `O20`) — đúng ca "cờ cảnh báo" T-1.
- `C32`: `is_tracked=Có`, 2 cơ hội mở, 0 bản chụp — ca "nguồn không đọc được" **thật**, thật hơn case giả lập hiện tại (chuỗi rỗng).
- `C29`, `C35`: trang tin tức nạp bằng JavaScript, HTML tĩnh không có nội dung — ca `fetch_status=failed` thật (README của BTC xác nhận).
- `C37`: có cơ hội mở nhưng `is_tracked=Không` — ca ranh giới "không theo dõi thì vòng quét không đụng".
- 6+ công ty vừa tracked, vừa có cơ hội mở, vừa đủ 3-4 cặp trang trước/sau (`C18`, `C16`, `C23`, `C26`, `C28`, `C38`) — thừa cho T-6/T-7/T-8.
- Không có cơ hội nào sẵn ở "Đủ điều kiện"/"Thua" — không sao, T-1 là test kéo-thả bằng tay qua UI, không cần seed có sẵn.

**Kết luận: dữ liệu thật đủ giàu để thay thế hoàn toàn seed hư cấu, không cần giữ song song.**

## 3. Vấn đề kiến trúc hiện tại chặn đường đi thẳng

| Chỗ chặn | Vị trí | Vì sao chặn |
|---|---|---|
| Bản chụp giới hạn 1 trang/công ty | `apps/api/src/ai/demo-snapshots.ts`, hằng số TS (ADR-0021) | ADR-0021 tự nêu điều kiện xem lại: "phình quá ~5 công ty" — thực tế 24 công ty × tới 4 trang đã vượt xa |
| Dữ liệu thực thể viết tay | `packages/db/src/seed/seed-data.ts` | Mảng TS cứng, không có đường nạp từ file ngoài (ADR-0013 đã tiên liệu, nhưng phương án ADR-0013 chọn là "thay file", không phải "xoá khái niệm file viết tay") |
| API không có quyền xoá | `apps/api` chỉ giữ kết nối `crm_app`/`crm_system`, `TRUNCATE` chỉ CLI (`crm_owner`) làm được | Hàng rào phân quyền cố ý (chặn AI xoá dữ liệu người tạo) — nhưng hành động reset demo là hành động của **admin** (người), không phải AI, nên cần một lối đi riêng có kiểm soát, không phải phá hàng rào |
| Test gắn cứng tên hư cấu | ~15 file `apps/api/src/**/__tests__/*.test.ts` + `e2e/t1-*.spec.ts`, `t5-*`, `t6-t7-*`, `t8-*`, `reading-zone-provenance.spec.ts` | Đọc trực tiếp ID/tên Sakura/Nimbus/Kitefin/Ohara/Marlin — phải viết lại để trỏ vào công ty thật |

## 4. Phương án đã cân nhắc

| Phương án | Ưu | Nhược | Kết luận |
|---|---|---|---|
| A. Giữ seed hư cấu làm mặc định cho `pnpm seed`/bộ test, upload zip là nhánh phụ chỉ phục vụ demo | Rủi ro thấp nhất cho bộ test chấm điểm tự động, không đụng file test nào | Không đúng yêu cầu — vẫn còn "dữ liệu viết tay" song song, hai nguồn sự thật, đúng cái CLAUDE.md mục 8 cấm ("ontology viết trong file md nhưng code không đọc = trang trí") | ❌ Loại — người quyết định bác |
| B. Bake dữ liệu thật (đã dọn) thành `seed-data.ts` mới, thay hoàn toàn hư cấu | Không cần parse zip lúc CLI seed, nhanh | Vẫn là "gõ tay" theo nghĩa dữ liệu nằm trong code, đi ngược tinh thần "nạp không sửa mã, một nguồn duy nhất" | ❌ Loại — người quyết định bác |
| **C. Không còn `seed-data.ts` nào. Nguồn dữ liệu duy nhất là file zip, một hàm `parseZipDataset()` dùng chung cho cả CLI và endpoint upload** | Một nguồn sự thật, đúng tinh thần "không sửa mã khi đổi dữ liệu", `pnpm seed` và tính năng upload zip cùng một cơ chế, dễ giải thích | Phải viết importer đủ chắc (parse CSV thật, validate, lọc mã mồ côi) trước khi `pnpm seed` chạy được — không còn đường lùi hardcode nếu importer có bug | ✅ **Chọn** |

## 5. Giải pháp chọn — kiến trúc

```
hackathon-1-data.zip (checked-in repo, dùng cho CLI + test)
        │
        ├── CLI: pnpm seed ──────────────┐
        │                                 ▼
        └── UI: POST /admin/import-data  parseZipDataset(buffer)
                    (admin, multer)           │
                                               ▼
                                        SeedDataset { companies, contacts,
                                          opportunities, snapshotPages }
                                               │
                                               ▼
                                  seed(connection, dataset)
                              TRUNCATE ALL_TABLES CASCADE + INSERT
                                    (chạy qua DRIZZLE_OWNER)
```

1. **`parseZipDataset(buffer): SeedDataset`** — hàm thuần, dùng chung. Unzip → parse 3 CSV bằng parser thật (không split dòng tay — `notes` có xuống dòng trong ô, đã xác minh naive line-split đếm sai số dòng) → lọc `company_code` mồ côi (cảnh báo, không throw — rule 4: trống hơn sai) → reverse-lookup `company_type`/`stage` qua `COMPANY_TYPE`/`STAGE` của `packages/contracts` → gom `snapshot/*.html` theo `company_code`+page-slug+variant từ tên file → convert `is_tracked` → `isWatched`. `sales_owner` bỏ, không model (chỉ có 1 tài khoản sales, ADR-0033).

2. **Bảng `snapshot_pages` mới** thay `demo-snapshots.ts` hoàn toàn: `company_id`, `page_slug`, `source_url`, `before_html`, `after_html`. `DemoSnapshotSource.read(companyId, variant): Snapshot | null` → **`readAll(companyId, variant): Snapshot[]`**, query bảng này. Downstream (`ObservationService.collectReads` → loop → `ingestOne`) đã sẵn hỗ trợ N nguồn/công ty (xây cho `company_sources`/live-crawl) — chỉ đổi đúng một điểm gọi.

3. **`seed()` tổng quát hoá**: `packages/db/src/seed/index.ts` nhận `dataset: SeedDataset` thay vì import trực tiếp `SEED_COMPANIES` v.v. `runFromCli()` đọc zip checked-in repo (đường dẫn cố định, ví dụ `packages/db/seed-assets/hackathon-1-data.zip`) qua `parseZipDataset`, gọi `seed()`. Giữ nguyên cơ chế TRUNCATE CASCADE + INSERT trong transaction — hành vi "nạp lại về đúng trạng thái ban đầu" không đổi.

4. **`DRIZZLE_OWNER`** — token kết nối mới, quyền `crm_owner`, chỉ inject vào đúng một service (`AdminImportService`) đứng sau `@Roles('admin')` + `JwtGuard`. Cần **ADR riêng**: đây là lỗ hổng có chủ đích duy nhất vào hàng rào phân quyền vốn cấm API xoá dữ liệu — phải nói rõ vì sao an toàn (hành động của admin người thật, không phải AI, tương đương chạy CLI) và giới hạn phạm vi (đúng một route, không service nào khác được inject token này).

5. **UI**: panel mới trên `/quan-tri` (đã admin-only) — file input nhận `.zip`, modal xác nhận ("Toàn bộ dữ liệu hiện tại sẽ bị xoá và thay bằng dữ liệu trong file này"), tóm tắt sau khi nạp (số công ty/liên hệ/cơ hội/trang bản chụp, danh sách dòng bị lọc do mã mồ côi).

6. **Dòng thời gian khi vòng quét gộp nhiều trang đổi cùng lúc**: một công ty có 2-3 trang cùng đổi trong một chu kỳ → **một mục dòng thời gian tổng hợp**, không phải N mục rời (quyết định đã chốt) — cần logic gộp mới trong `claim-reaction-service`/`system-timeline-entry-service`, hiện tại phản ứng theo từng claim độc lập.

7. **Viết lại bộ test đang gắn cứng tên hư cấu** — 15 file `apps/api/src/**/__tests__` + 5 e2e spec (T-1, T-5, T-6/T-7, T-8, reading-zone-provenance) trỏ sang công ty thật. Gợi ý ánh xạ (cần xác nhận nội dung HTML thật khớp trước khi khoá):

   | Vai trò trong test cũ | Công ty hư cấu cũ | Công ty thật gợi ý |
   |---|---|---|
   | Nguồn không đọc được | Ohara (rawHtml rỗng, giả lập) | `C32` (không có website — thật) hoặc `C29`/`C35` (JS-blocked — thật) |
   | Công ty flip T-6/T-7 | Sakura | `C18` hoặc `C16` (tracked, 4 cặp trang, có cơ hội mở) |
   | 3 công ty T-8 (flip 2) | Sakura/Nimbus/Kitefin | Bất kỳ 3 trong `{C18, C16, C23, C26, C28, C38}` |
   | Cơ hội cờ cảnh báo T-1 | dựng tay trong seed | `O18`/`O19`/`O20` (có sẵn, không cần dựng) |

## 6. Rủi ro

- **Lớn nhất: viết lại bộ test chấm điểm ngay trước giờ chốt vòng 1 (15:00 hôm nay)**. Đây là thay đổi diện rộng, khó rollback gọn nếu làm dở dang giữa chừng — nên làm theo plan có phase rõ, chạy test sau mỗi phase chứ không đợi xong hết mới chạy.
- Nội dung HTML thật của từng trang chưa được grep để xác nhận đúng loại tín hiệu (`funding`/`leadership_hire`...) khớp công ty nào — bảng ánh xạ ở mục 5.7 là gợi ý, cần xác minh khi implement, không phải đã khoá.
- `DRIZZLE_OWNER` là thay đổi kiến trúc phân quyền — bắt buộc có ADR và test riêng chứng minh chỉ đúng một route dùng được (giống tinh thần các ADR 0010/0015/0017 đã có).
- File zip 16MB checked vào repo — không phải bí mật (BTC phát công khai cho mọi đội), nhưng cần xác nhận không phạm giới hạn kích thước repo/CI nào đội đang có.

## 7. Success metrics / validation

- `packages/db/src/__tests__/seed-idempotent.test.ts` (hoặc bản viết lại) chạy `seed()` hai lần với cùng file zip → cùng checksum trạng thái, như đang có với seed hư cấu hiện tại.
- Tóm tắt sau khi upload đúng: 25 công ty, 38 liên hệ, 15 cơ hội thật + cảnh báo rõ 8 dòng bị lọc.
- Toàn bộ T-1..T-10 xanh khi chạy trên dữ liệu thật.
- Upload lại đúng cùng file `hackathon-1-data.zip` → hệ thống về đúng trạng thái ban đầu, diễn lại được kịch bản demo (đúng yêu cầu gốc mục 7 điều kiện 5).

## 8. Bước tiếp theo

Chuyển sang `/ck:plan` để chia phase implementation. Đề xuất thứ tự phase theo đúng thứ tự phụ thuộc: (1) `snapshot_pages` + tổng quát hoá `DemoSnapshotSource`/`seed()` trước — vì importer cần cấu trúc này tồn tại mới viết được; (2) `parseZipDataset` + `AdminImportService`/`DRIZZLE_OWNER` + route + UI; (3) viết lại bộ test T-1/T-5/T-6/T-7/T-8 và các unit test gắn cứng tên hư cấu, chạy xanh trên dữ liệu thật; (4) ADR cho `DRIZZLE_OWNER` và cập nhật ADR-0013/ADR-0021 (đánh dấu đã superseded).
