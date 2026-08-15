# ADR-0021 — Bản chụp demo giữ dạng hằng số TypeScript trong `apps/api/src/ai/`, không tách thành file HTML

| | |
| --- | --- |
| **Ngày** | 2026-08-13 19:56 |
| **Giai đoạn** | Design (phase 4 — seed + bản chụp trước/sau + T-1) |
| **Trạng thái** | Thay thế bởi [ADR-0042](0042-quyen-crm-owner-ngan-han-cho-import-tu-giao-dien.md) — điều kiện xem lại ADR này tự nêu ("bộ bản chụp phình quá ~5 công ty") đã xảy ra: dữ liệu BTC thật mang 25 công ty × tới 4 trang/công ty. `demo-snapshots.ts` bị xoá, bản chụp giờ nằm ở bảng `snapshot_pages`, đọc qua `DemoSnapshotSource` DB-backed |
| **Người quyết định** | HungLV |
| **Prompt log** | phiên brainstorm phase 4 ngày 13/08 19:36 — [báo cáo](../../plans/reports/from-brainstorm-to-planner-260813-1956-GH-3-phase-04-seed-ban-chup-va-t1-report.md) |

## Bối cảnh

Phase 4 được viết **trước khi phase 2 xong**, và nó đặt bản chụp web ở `packages/db/src/seed/snapshots/` dạng file HTML tĩnh, đặt tên `cong-ty-N-truoc.html` / `-sau.html`.

Phase 2 đã ship trước, và nó đặt bản chụp ở chỗ khác dạng khác: `apps/api/src/ai/demo-snapshots.ts` — hằng số TypeScript, 4 công ty × `before`/`after`, đọc qua `DemoSnapshotSource`. HTML trong đó **bẩn có chủ ý** (tag lồng, `&nbsp;`, khối `<script>`, khoảng trắng lệch) để `normalizeSnapshotText` có gì mà chịu; HTML sạch sẽ làm bộ chuẩn hoá trông đúng mà không bị thử.

Nên câu hỏi không còn là "đặt bản chụp ở đâu" mà là **"có bỏ chỗ đang chạy để dời sang chỗ phase file đã viết hay không"**, với hạn feature freeze tối 14/08.

Lực kéo về phía file HTML là thật: [ADR-0013](0013-seed-theo-du-lieu-tu-dat-chap-nhan-migrate-khi-btc-giao-du-lieu.md) hứa "khi BTC giao dữ liệu chỉ thay `seed-data.ts`", và bản chụp nằm ngoài file đó thì lời hứa một-file không còn đúng.

## Phương án đã cân nhắc

Tiêu chí: *(1)* rủi ro chỉ hiện trên stack production · *(2)* số dòng phải sửa ở code đang xanh · *(3)* lời hứa một-file của ADR-0013 · *(4)* biên chủ quyền file giữa A và C.

| Phương án | Ưu | Nhược | Kết luận |
| --- | --- | --- | --- |
| **A.** Giữ hằng số TS, mở rộng `demo-snapshots.ts` | `DemoSnapshotSource` không đổi một dòng; 15 test của phase 2 không cần chạm; **không có asset rời nào phải copy vào image** | Nội dung nằm ở `apps/api` (A sở hữu) chứ không `packages/db` (C sở hữu) → phase 4 phải sửa file của A. ADR-0013 thành "thay 2 file" | ✅ **Chọn** |
| **B.** Dời sang file HTML trong `packages/db/src/seed/snapshots/`, đọc bằng `fs` | Đúng phase file; giữ lời hứa một-file; nội dung về đúng nhà của C; xem diff bản trước/sau bằng mắt dễ hơn | Viết lại `DemoSnapshotSource`; import xuyên package vào ruột seed; và **API build standalone — file HTML rời phải được copy vào image, thiếu thì `ENOENT` chỉ nổ khi chạy `pnpm start`**, tức đúng cái stack e2e chấm và giám khảo mở | ❌ Loại — tiêu chí (1) |
| **C.** File HTML nhưng nhúng thành chuỗi lúc build | Có cả hai mặt tốt | Cần loader/plugin cho `.html` trong toolchain của cả Nest và Vitest. Thêm một mắt build mới, hai ngày trước freeze | ❌ Loại — tiêu chí (1), đổi rủi ro runtime thành rủi ro build |

## Quyết định

Chọn **A**. Bản chụp là hằng số TypeScript trong `apps/api/src/ai/demo-snapshots.ts`. Phase 4 **mở rộng** file đó (thêm công ty `it_product` thứ năm), không dời nó.

Hệ quả cho cách đọc [ADR-0013](0013-seed-theo-du-lieu-tu-dat-chap-nhan-migrate-khi-btc-giao-du-lieu.md): khi BTC giao dữ liệu, chỗ phải thay là **hai** file — `packages/db/src/seed/seed-data.ts` (thực thể) và `apps/api/src/ai/demo-snapshots.ts` (nội dung trang). Tinh thần của ADR-0013 không đổi (dataset tách khỏi loader, không sửa logic khi dữ liệu về); chỉ con số một-file là sai và ADR này sửa nó.

## Hệ quả

- **Ranh giới nội dung/thực thể trở thành ranh giới package**, và cái đó có lý riêng: seed ghi *thực thể* vào CSDL, còn *nội dung trang* không bao giờ được seed ghi — `Observation` là vùng tự chủ 1, chỉ `crm_system` mới INSERT được, sinh lúc chạy qua `ObservationService.ingest`. Seed mà chèn thẳng `observations` sẽ tạo bản lưu **không có phát hiện nào**, và vùng đọc trên màn hình sẽ trống trơn không giải thích được.
- **Phase 4 (C) sửa một file của A.** Sửa thuộc loại thêm dữ liệu, không đổi cấu trúc: thêm một khoá vào `SNAPSHOTS`. `DemoSnapshotSource` không đổi. Đây là ngoại lệ có ý thức với bảng chủ quyền file, không phải quên.
- Diff giữa bản trước và bản sau đọc bằng mắt khó hơn file HTML rời. Bù bằng luật đã có của phase 4: **mỗi bản "sau" thêm đúng một đoạn**, nên diff luôn là một khối `<p>`.
- **Sẽ phải xem lại nếu:** có crawler thật (lúc đó `DemoSnapshotSource` bị thay hẳn, câu hỏi này biến mất), hoặc bộ bản chụp phình quá ~5 công ty tới mức file khó đọc — lúc đó tách theo công ty trong cùng thư mục `src/ai/`, vẫn là TS, không sang HTML.

## AI đã tham gia thế nào

- **Vai trò AI:** phiên này scout code trước khi hỏi, và chính nó phát hiện bảng bản chụp trong phase-04 đã lệch: bản chụp tồn tại rồi, ca `fetch_status = failed` có rồi (Ohara `rawHtml: ''`), và ca "bản sau giống hệt bản trước" là phủ trùng vì I-3 đã có test 6 + test 7.
- **AI sai ở đâu:** **phase-04 do AI viết ở phiên trước, và bảng bản chụp trong đó gán tin `funding` cho công ty `tech_startup` rồi mong nó tự đặt Việc tiếp theo.** Sai: [I-6](../ontology.md) không đọc loại công ty, nó đọc `signal_type ∈ {funding, leadership_hire}` **và** có ≥1 cơ hội mở. Nếu làm theo bảng cũ thì T-6 sẽ được xây trên một tiền đề không đúng, và phát hiện ra lúc chạy chứ không lúc đọc.
- **AI đề xuất gì mà đội không nghe:** ở câu hỏi hình dạng T-1, AI khuyến nghị tách ba spec; đội chọn một spec liền mạch. Hoà giải: giữ một spec, bọc từng chặng trong `test.step()` để reporter chỉ ra chặng đỏ.

## Đội đã verify bằng cách nào

Cả bốn đều là **đọc mã nguồn**, không phải chạy đo — nói rõ vì kết luận chỉ mạnh bằng cách kiểm:

- `apps/api/src/ai/demo-snapshots.ts` — đếm tay 4 công ty × 2 biến thể; xác nhận Ohara `rawHtml: ''` ở cả hai biến thể và `read()` trả `null` khi `rawHtml.trim().length === 0`, tức ca `failed` **đã** có nguồn không đọc được thật, không phải chỉ có trong test.
- `apps/api/src/domain/observation/__tests__/reading-zone-provenance.test.ts` — test 6 assert đọc lại nội dung y nguyên thì **extractor gọi 0 lần**; test 7 assert trước→sau→trước đều lưu. Hai ca này là lý do bỏ yêu cầu "công ty có bản sau byte-identical".
- `docs/ontology.md:156` — đọc nguyên văn I-6 để bác bảng cũ.
- `packages/db/src/seed/index.ts:41-47` + `schema/all-tables.ts:29-46` — `TRUNCATE` chạy trên đủ 15 bảng, nên bước "bổ sung dọn dẹp I-14" của phase 4 là việc đã xong.

**Chưa kiểm bằng cách chạy:** rủi ro `ENOENT` của phương án B là suy luận từ cách Next/Nest build standalone, **không phải lỗi đã bắt được trên repo này**. Nếu ai muốn lật ADR này thì đó là chỗ phải đo trước.

## Rollback

Đổi sang phương án B là việc cục bộ: thay ruột `DemoSnapshotSource.read()` bằng `readFileSync`, giữ nguyên chữ ký. Nhưng **phải đo trên `pnpm start` chứ không trên `pnpm dev`** — `next dev`/`nest start` đọc được file trong repo nên sẽ xanh giả.
