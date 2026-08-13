---
date: 2026-08-13 20:45
session: 19:58 – 20:45 (Asia/Saigon)
component: Phase 4 — seed bản chụp trước/sau, cột snapshot_variant, T-1
plan: plans/260813-0107-feature-groups-1-6-and-acceptance-suite
status: xong, chưa commit (người đọc diff trước)
adr: [0022 (trả nợ đo), 0020 (dùng số đo khoảng cách phím), 0021, 0013]
---

# T-1 đỏ ba lần, không lần nào vì sản phẩm

## Bối cảnh

Phase 4 vào việc với một lợi thế lạ: bản phase đã được hoà giải với code thật lúc 19:56, bốn hạng mục bị bỏ vì đã có sẵn, một lỗ hổng (T-8 không đóng được vì `variant` là tham số request) đã được bịt bằng ADR-0022. Nên phiên này gần như không có quyết định thiết kế nào phải cãi — chỉ có việc làm, và **một nợ đo phải trả**.

Kết quả: **170 unit + 7 e2e xanh** (từ 165 + 6). Cộng 4 file mới, 1 migration, 1 module API, 1 CLI.

---

## Chuyện gì đã xảy ra

### Nợ đo của ADR-0022, và phép đo đột biến đi kèm

ADR-0022 tự ghi vào cuối: *"cột mới được phủ bởi GRANT mức bảng là suy luận từ ngữ nghĩa `GRANT` của Postgres, chưa phải số đo trên `crm_test`"*. Đây là loại nợ dễ quên nhất vì nó **đúng** — Postgres đúng là hoạt động như thế. Nhưng `0001_grants.sql` tồn tại chính vì một suy luận cùng hình dạng đã sai khi đem đo (`GRANT UPDATE` mức bảng + `REVOKE` theo cột = **không chặn gì**).

Đo xong, 5 ca: `crm_system` UPDATE → `permission denied`; SELECT → đọc được (vòng quét cần); `crm_app` UPDATE → thành công **mà không viết thêm một dòng GRANT nào**; công ty mới → `'before'`; giá trị thứ ba → `CHECK` từ chối.

Phép đo đột biến quan trọng hơn cả 5 ca đó: `GRANT UPDATE (snapshot_variant) ON companies TO crm_system` → ca "bị từ chối" đỏ ngay, **và ca đọc cũng đỏ vì AI đã thật sự ghi `'after'` vào cột**. Cái thứ hai là bằng chứng pool trong test đúng là `crm_system`, không phải một pool cấu hình sai đang xanh vì lý do khác. `REVOKE` → xanh lại; `information_schema.column_privileges` xác nhận chỉ còn SELECT trên cả 13 cột.

### Cột demo trong bảng nghiệp vụ: cái giá đã trả trước

ADR-0022 chọn `companies.snapshot_variant` và ghi rõ nhược điểm: trạng thái giàn giáo nằm trong bảng của Sales. Phiên này thấy cái giá đó **đã được trả trước** ở P3: `CompanyService.toDto()` liệt kê từng cột thay vì `SELECT *`, nên cột mới không lọt ra API mà không ai phải sửa gì. Một quy ước viết cho lý do khác lại chặn đúng chỗ này.

Chỗ đáng ghi thứ hai: `snapshot_variant` **được đưa vào** danh sách cột nghiệp vụ của `seed-idempotent.test.ts`. Nếu để ngoài thì test I-14 vẫn xanh trong khi seed lần hai có thể để một công ty ở bản `'after'` — nghĩa là giám khảo diễn lại lần hai thấy kịch bản khác lần một, đúng thứ I-14 cấm. Thêm hẳn một ca: đổi cả 5 công ty sang `'after'`, seed lại, đếm số công ty còn lệch = 0.

### Công ty thứ 5: bỏ được, nhưng làm

Marlin Product Labs (`it_product`) là hạng mục plan đánh dấu "cắt được đầu tiên". Làm, vì rẻ và vì nó là câu trả lời vòng 2 duy nhất chứng minh **ống kính loại công ty không phải trang trí**: cùng một tin gọi vốn, hai loại công ty, hai nhận định.

Điểm kỹ thuật: đoạn funding **không được gõ hai lần**. Nó là một hàm `fundingParagraph(companyName)` dùng cho cả Sakura và Marlin, nên biến duy nhất còn lại là `company_type`. Hai đoạn gõ tay sẽ trôi, và lúc đó khác biệt trong nhận định có thể đến từ cách diễn đạt chứ không từ ống kính — phép so sánh mất nghĩa mà vẫn trông như còn nghĩa. `demo-snapshots.test.ts` khoá cả tính chất này lẫn luật "mỗi bản sau đúng một đoạn mới".

---

## Ba lỗi harness, không lỗi nào của sản phẩm

Đây là phần đáng ghi nhất, và ADR-0020 đã báo trước đúng loại: *"đỏ mà không phải lỗi sản phẩm — mất thời gian nhất đúng vào ngày cuối"*.

**1. Container web là bản build 17 giờ trước.** T-1 đỏ ở `Thêm người liên hệ` không tìm thấy. Đã đi tìm lỗi trong `ContactSection`, trong thứ tự render, trong dialog còn mở. Gốc: ảnh web đang chạy có **trước P3**, nên trang chi tiết công ty chỉ có Hồ sơ và Vùng đọc — `ContactSection` và `TimelineSection` chưa hề tồn tại trong ảnh đó. Cái đã tìm ra gốc không phải suy luận mà là **in nguyên văn text của `<main>`** ra bằng một spec dùng một lần.

Rút ra: `pnpm test:e2e` seed lại CSDL nhưng **không** build lại ảnh. Trạng thái dữ liệu tất định không có nghĩa trạng thái *mã* tất định. Trước khi tin một kết quả e2e: `docker compose up --build`.

**2. `getByText` khớp chuỗi con.** `getByText('Đầu mối chính')` khớp 2 phần tử: badge, **và** nút `Đặt làm đầu mối chính` của người còn lại. Khẳng định `toHaveCount(1)` cho "đúng một đầu mối chính" vì thế đo sai thứ — nó đo badge cộng nút. Cùng bẫy ở `getByLabel('Dấu hiệu nhu cầu')` khớp cả `Nguồn của dấu hiệu nhu cầu`. Luật: **nhãn nào là tiền tố của nhãn khác thì phải `{ exact: true }`.**

**3. `picked up` không bao giờ khớp.** Đây là cái tinh nhất. ADR-0020 ghi vùng `aria-live` của dnd-kit là đường chờ tất định, và đúng — nhưng chuỗi đầu tiên nó phát **không phải** "Picked up". Nhấc thẻ lên là dnd-kit thông báo ngay `moved over droppable area <chính id của thẻ đó>`, vì thẻ đang nằm trên ô sortable của chính nó. Chờ `/picked up/` là chờ một trạng thái đã trôi qua.

Sửa sai lần đầu của tôi cũng sai: đổi sang chờ `moved over droppable area <mã giai đoạn đích>`. Nó **xanh giả** — chuỗi `moved over` đã có sẵn từ lúc nhấc, nên khẳng định pass trước cả khi bấm mũi tên; và `over.id` có thể là một **thẻ** trong cột đích chứ không phải mã cột (cột `Đủ điều kiện` và `Thương lượng` đều đã có deal từ seed), `stageOf()` quy cả hai về một giai đoạn nên sản phẩm đúng mà khẳng định thì giòn.

Cách đúng: chờ vùng `aria-live` **đổi nội dung** so với ngay sau lúc nhấc. Chỉ phụ thuộc "vùng này có cập nhật", không phụ thuộc dnd-kit đặt tên droppable ra sao.

### Điều rút ra, áp cho P5–P8

1. **Khi e2e đỏ, hỏi "mã đang chạy có phải mã tôi vừa viết không" TRƯỚC khi đọc mã.** Hai lượt chạy mất vì bỏ qua câu này.
2. **Một khẳng định xanh chưa chắc đo cái nó nói.** Cả lỗi 2 và lỗi 3 lần đầu đều là khẳng định xanh/đỏ vì lý do khác lý do đã viết ra. Cách phát hiện: bắt nó **đỏ có chủ ý** — đúng cái phép đo đột biến làm cho GRANT.
3. **Chờ theo "trạng thái đổi", không theo "chuỗi cụ thể", khi chuỗi thuộc thư viện.** Chuỗi của thư viện là hợp đồng không ai hứa với mình.
4. **Timeout mặc định 30s của Playwright là ngân sách cho MỘT tương tác.** T-1 chín chặng nên tự nâng 180s trong spec — không nâng ở config, để spec khác giữ mức chặt bắt được màn hình chậm.

---

## Quyết định

| Quyết định | Vì sao | Ghi ở đâu |
| --- | --- | --- |
| Migration sinh bằng `db:generate` rồi **đổi tên** thành `0004_snapshot_variant.sql` | Viết tay thì `meta/0004_snapshot.json` không có, và lần `db:generate` sau sẽ sinh lại `ADD COLUMN` lần hai. Đổi tên + sửa `tag` trong `_journal.json` giữ được cả tên tự mô tả lẫn snapshot | `0004_snapshot_variant.sql` |
| `check()` khai trong schema, **không** chỉ trong SQL | Để `db:generate` lần sau không thấy CHECK là khác biệt cần sinh thêm | `schema/companies.ts` |
| Zod schema của endpoint demo đặt **trong module demo**, không vào `@crm/contracts` | Contracts là thứ mọi màn hình dùng được. Đưa đường đổi nguồn vào đó là phát cho mọi màn hình một cách đổi nguồn ngoài ý muốn | `demo.controller.ts` |
| `switch-snapshot` CLI nối `DATABASE_URL_APP`, **không** `_OWNER` | Đổi bản chụp là hành vi của **người**. Chạy bằng role bỏ qua quyền theo cột thì không chứng minh được ai được phép làm | `switch-snapshot.ts` |
| Tên khớp nhiều công ty → **từ chối**, không lấy cái đầu | Flip sai công ty giữa lúc demo trông y hệt vòng quét hỏng | `switch-snapshot.ts` |
| Khoá `ai_enabled` viết thẳng chuỗi trong `e2e/`, không import `@crm/db` | `@crm/db` phân giải sang `dist`, nên import kéo theo "phải build package trước khi chạy e2e" | `turn-ai-off.ts` |
| Contact của Nimbus **không phải** bà Tan Wei Ling | Bà ấy là tin trong bản chụp `after` của Nimbus. Seed sẵn người đó là biến tin sắp về thành tin đã biết | `seed-data.ts` |
| `pg` + `dotenv` thành devDependency ở **gốc** | pnpm không cho gốc mượn node_modules của `packages/db`, mà `e2e/` là suite ở gốc và cần nói chuyện với Postgres | `package.json` |

---

## Việc tiếp theo

| Việc | Khi |
| --- | --- |
| **Người đọc diff rồi commit.** Working tree còn nguyên, 14 file sửa + 7 file mới | ngay |
| **P7 (nhóm 5, vòng quét)** — đã mở khoá: cột có, hai đường đổi có | 14/08 trưa theo mốc plan |
| **P5, P6** — không phụ thuộc P4 | song song |

## Còn treo

- **Vòng quét giờ có 3 công ty theo dõi, không phải 1.** Đúng yêu cầu T-8, nhưng nhịp 60s × 3 lần gọi LLM là chi phí P7 phải cân. ADR-0011 đã có luật bỏ nhịp + `skipped_reason`, chưa ai đo với 3 công ty.
- **Hai nguồn nói "đọc bản nào".** Ingest tay đọc body, vòng quét đọc cột. Mùi đã chấp nhận có ý thức trong ADR-0022 để không phải chạm 15 test của P2 hai ngày trước freeze. Nếu sau freeze còn giờ: `variant` thành **tuỳ chọn** trong body, thiếu thì service đọc cột.
- **`pnpm build` cho `apps/web` vẫn gãy trên Windows** (`EPERM` ở bước symlink của Next standalone). Đã ghi trong README từ trước, không phải việc của phase này, nhưng nó nghĩa là **cửa build trên máy Windows không phủ `apps/web`** — chỉ Docker phủ. Ai chỉ chạy `pnpm build` rồi tin là xanh thì đang tin một thứ không chạy.
- **`apps/web` vẫn không có test đơn vị nào** (`vitest.config.mts` không collect nó — phát hiện từ phiên 1). T-1 giờ phủ luồng chính của nhóm 1 bằng e2e, nên nợ này nhỏ đi nhưng chưa mất.
- **Nợ verify ADR-0014 (LLM thật) vẫn 1/3**, chưa liên quan phase này nhưng vẫn là cửa chặn của P5/P6.
- **Q-6 (Admin thao tác CRM)** vẫn treo. **Telemetry thành viên 2 và 3** vẫn chưa verify trên Grafana.
