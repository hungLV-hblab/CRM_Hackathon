# ADR-0013 — Seed bằng bộ dữ liệu tự đặt, chấp nhận effort migrate khi BTC giao dữ liệu

| | |
| --- | --- |
| **Ngày** | 2026-08-13 01:10 |
| **Giai đoạn** | Development |
| **Trạng thái** | Thay thế bởi [ADR-0042](0042-quyen-crm-owner-ngan-han-cho-import-tu-giao-dien.md) — BTC đã giao dữ liệu (2026-08-15), `seed-data.ts` bị xoá hẳn, `seed()` giờ nhận `SeedDataset` parse từ zip thật, không còn hằng số tự đặt |
| **Người quyết định** | HungLV |
| **Prompt log** | *không có* — quyết trực tiếp trong phiên rà soát trạng thái 13/08 |

## Bối cảnh

Nộp bài mục 5 đòi **nạp được bộ dữ liệu của BTC bằng một lệnh**, chạy lần nữa về đúng trạng thái đầu. Tới 13/08 BTC **chưa phát format dữ liệu** và không có mốc hẹn.

Cùng lúc, nhóm 2/4/5 không code được mà không có dữ liệu: T-6 và T-8 đòi bản chụp web **hai phiên bản "trước" và "sau"** để chứng minh vòng quét phát hiện nội dung mới. Chờ format = mất ngày 13/08, tức mất một trong hai ngày build duy nhất trước feature freeze tối 14/08.

## Phương án đã cân nhắc

| Phương án | Ưu | Nhược | Kết luận |
| --- | --- | --- | --- |
| A. Seed bằng dữ liệu tự đặt theo ontology, giữ dataset tách khỏi loader | Đi được ngay hôm nay; có bản chụp trước/sau đúng nhu cầu T-6/T-8; điều kiện "1 lệnh + idempotent" đạt độc lập với ai cấp dữ liệu | Khi BTC giao dữ liệu phải bỏ công map lại, có thể phát sinh cả migration nếu dữ liệu có thực thể ngoài ontology | ✅ **Chọn** |
| B. Chờ BTC phát format rồi mới viết seed | Không phải làm hai lần | Chặn nhóm 2, 4, 5 vô thời hạn vì phụ thuộc bên ngoài không kiểm soát được. Đổi rework **có thể xảy ra** lấy delay **chắc chắn xảy ra** | ❌ Loại |
| C. Viết loader tổng quát (import schema-agnostic + file mapping) trước khi biết format | Đón được mọi format | Chi phí chắc chắn để đổi lấy một rủi ro chưa biết hình dạng — vi phạm YAGNI. Đề bài đòi nạp **bộ dữ liệu của BTC** bằng 1 lệnh, không đòi nạp mọi format | ❌ Loại |

## Quyết định

Chọn **A**. Tiêu chí so: *ngày build còn lại* là tài nguyên khan nhất và không mua lại được; effort map dữ liệu thì mua được bằng tiền công sau. B đổi tài nguyên khan lấy tài nguyên dư. C trả chi phí ngay cho một yêu cầu chưa tồn tại.

Giữ nguyên đường nối đã có: `packages/db/src/seed/seed-data.ts` chứa **dữ liệu thuần**, `seed/index.ts` chứa **loader idempotent**. Khi BTC giao dữ liệu, việc phải làm gói trong việc thay `seed-data.ts` — miễn là dữ liệu đó nằm trong phạm vi ontology.

## Hệ quả

- Kéo theo: bản chụp web fixture "trước/sau" là **dữ liệu seed của đội**, đánh dấu rõ là seed (CLAUDE.md mục 6), không lẫn với dữ liệu người dùng nhập.
- Kéo theo: mọi thực thể mới thêm vào seed phải có tên trong ontology mục 3, để việc map dữ liệu BTC về sau là đổi giá trị chứ không phải đổi cấu trúc.
- Đánh đổi chấp nhận: nếu dữ liệu BTC mang thực thể hoặc quan hệ ngoài ontology thì phải migrate cả schema, không chỉ dataset. Đã cân, vẫn chọn A.
- Sẽ phải xem lại nếu: BTC phát format **trước trưa 14/08** và format đó lệch khỏi ontology — lúc đó map sớm rẻ hơn map muộn, dừng thêm dữ liệu seed mới ngay.

## AI đã tham gia thế nào

- Vai trò AI: rà soát trạng thái repo, chỉ ra rằng thiếu format dữ liệu BTC là rủi ro của hạng mục nộp bài số 5.
- AI đề xuất gì mà đội **không** nghe: AI đề nghị **hỏi BTC format càng sớm càng tốt và coi đó là việc gấp**. Người quyết định bỏ qua nhánh chờ đợi, chấp nhận rework để không mất ngày build.
- AI sai ở đâu: xếp việc này vào nhóm "gấp hơn code". Sai về mức độ — nó không chặn được gì cả, vì điều kiện nghiệm thu của mục 5 là *idempotent + một lệnh*, không phải *đúng dữ liệu của BTC*. Ngay cả khi BTC im tới cuối, đội vẫn nộp được mục 5.

## Đội đã verify bằng cách nào

Điều kiện nộp bài mục 5 đã có test giữ, **không phụ thuộc dataset là của ai**: `packages/db/src/__tests__/seed-idempotent.test.ts` chạy `seed()` hai lần và so trạng thái. Chạy thật lúc nghiệm thu skeleton 12/08 22:10: hai lần seed cho cùng chuỗi `2/4/3/2/2/0/0 | md5=2dd301579b48842b49fd7e7824c1d2de`, xoá sạch cả dữ liệu do e2e tạo lẫn giá trị sửa tay.

Nghĩa là: rủi ro còn lại **chỉ là công map dữ liệu**, không phải rủi ro trượt hạng mục nộp bài. Đó là căn cứ để chấp nhận A.

## Rollback

Không có gì để rollback — quyết định này chỉ là "không chờ". Khi dữ liệu BTC về: viết `seed-data.ts` mới, chạy `pnpm seed` + test idempotent. Ước lượng nửa ngày nếu dữ liệu nằm trong ontology; thêm một migration nếu không.
