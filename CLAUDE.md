# CLAUDE.md — Rule file dùng chung của đội

> **Bắt buộc cho cả người và AI.** Mọi thành viên dùng chung file này + chung bộ lệnh trong `.claude/commands/hack/`.
> Đây là bằng chứng "tích hợp nhóm — cả team dùng thống nhất 1 cách tiếp cận AI" (bonus đồng bộ nhóm).
> Cập nhật lần cuối: 2026-08-12 (Specs về — sửa luật 3 & mục 4 cho khớp hai vùng AI tự ghi mà đề bài mở).
>
> **Timeline:** Specs phát **12/08** → build **12–14/08** → **feature freeze tối 14/08** → 15/08 chỉ hardening + test + demo, vòng 1 chốt **15:00**.

## 1. Dự án

Xây một module của **hệ thống CRM nội bộ HBLAB** theo Specs của BTC, cho end user thật là **đội Sales các thị trường**. Sản phẩm phải là phần mềm **AI-native**: AI nằm trong lõi luồng nghiệp vụ, **không phải chatbot đính bên cạnh CRUD**.

Context bắt buộc đọc trước khi làm bất cứ việc gì:

| Doc | Dùng khi |
| --- | --- |
| [docs/hackathon-spec-ai-native-crm.md](docs/hackathon-spec-ai-native-crm.md) | **Đề bài nguyên văn.** Nguồn sự thật cho *cần cái gì* |
| [docs/hackathon-context.md](docs/hackathon-context.md) | Điểm khởi đầu, chiến lược, checklist |
| [docs/hackathon-rules-and-scoring.md](docs/hackathon-rules-and-scoring.md) | Rubric — quyết định *cách làm việc*, không chỉ *làm gì* |
| [docs/sales-ito-crm-domain.md](docs/sales-ito-crm-domain.md) | Mọi quyết định sản phẩm: hiển thị gì, ưu tiên gì |
| [docs/ai-native-design-principles.md](docs/ai-native-design-principles.md) | Kiến trúc & data model |
| [docs/ontology.md](docs/ontology.md) | **Đặt tên & ràng buộc.** Thực thể, quan hệ có tên, trần tự chủ, enum, chỉ số đo |

## 2. Bảy luật bất di bất dịch

1. **Không có provenance thì không hiển thị.** Mọi nhận định AI đưa ra phải bấm vào truy được về đúng đoạn văn nguồn. Ép ở tầng component, không ở tầng thiện chí lập trình viên.
2. **Fact và suy luận phải phân biệt được ngay bằng mắt.** Người dùng không được phép đoán đâu là dữ liệu, đâu là AI nghĩ ra.
3. **Máy chuẩn bị sẵn, người quyết định ghi — trừ hai vùng khai báo tường minh.** Mặc định AI không ghi vào dữ liệu chính thức. Specs mở đúng **hai** ngoại lệ (tự đặt Việc tiếp theo · vòng quét tự thêm mục dòng thời gian); ngoài hai chỗ đó, mọi thay đổi đi qua hàng đợi duyệt. Chỗ nào máy tự làm thì **sửa lại phải dễ hơn cả lúc máy làm**, và số lần bị sửa phải đo được. Chi tiết ở mục 4.
4. **Một dòng dữ liệu sai tệ hơn một dòng để trống.** Không chắc thì để trống + nói rõ vì sao trống.
5. **Next step là nhịp tim của deal.** Màn hình chính phải trả lời được "sáng nay tôi phải làm gì, cho deal nào".
6. **Đo được từ ngày đầu.** Mọi proposal ghi nhận accept / reject / sửa → auto-accept rate + error-detection rate.
7. **Giải thích được, nếu không thì không merge.** Bất kỳ ai trong đội cũng phải bảo vệ được mọi output AI đã đưa vào sản phẩm (vòng 2 hỏi random 3–5 câu dựa trên log).

## 3. Từ vựng bắt buộc — dùng đúng tên trong code

Ontology quyết định cách đặt tên. Không tự đặt từ đồng nghĩa.

| Đối tượng | Từ trong Specs | Nghĩa | Ai được tạo |
| --- | --- | --- | --- |
| `Observation` | **bản lưu** | Dữ liệu thô quan sát được, **luôn có timestamp + cấp nguồn** (bản chụp web, transcript, email, news) | AI tự do |
| `Claim` | **phát hiện** | Mệnh đề **suy ra** từ observation, có độ tin cậy. Summarize cũng là claim | AI tự do (chưa chạm dữ liệu chính thức) |
| `Proposal` | **gợi ý** | Gợi ý hành động kèm đầy đủ bằng chứng, **chờ người duyệt** | AI đề xuất, **người duyệt** |
| `Provenance` | **câu trích + vị trí** | Đường đi từ claim/proposal về đúng observation gốc | Hệ thống, bắt buộc |

Giao diện dùng **từ tiếng Việt của Specs** (Sales đọc); code dùng **tên tiếng Anh** ở cột 1. Bảng ánh xạ đầy đủ mọi thực thể ở [docs/ontology.md](docs/ontology.md) mục 3.

Ranh giới: **ghi chép 1-1 không phải claim; hễ biến đổi thông tin gốc là claim.**

Quan hệ giữa các đối tượng **phải có tên đọc lên thành câu** ("Contact **làm việc cho** Company"). Không gọi tên được quan hệ = chưa hiểu domain, dừng lại và hỏi.

## 4. Trần tự chủ của AI trong sản phẩm

Khai báo tường minh, enforce bằng code chứ không chỉ ghi cho đẹp. **Bốn vùng, tự chủ tăng dần** — mỗi vùng có một cơ chế an toàn khác nhau, không được lẫn:

| Vùng | AI được làm gì | Cơ chế an toàn | Test |
| --- | --- | --- | --- |
| **1 · Tự do** | Tạo `Observation` (đọc bản chụp, ingest note) và `Claim` (rút phát hiện) | Không chạm dữ liệu chính thức. Claim không có câu trích nguyên văn → **không lưu được** | T-2, T-2b |
| **2 · Chờ duyệt** | Sinh `Proposal`: sửa ô hồ sơ công ty, thêm tin vào dòng thời gian | **Không duyệt thì không có gì xảy ra**, vô thời hạn. Không tự hết hạn thành hành động | T-4, T-5 |
| **3 · Tự ghi, hoàn tác được** | Tự điền **Việc tiếp theo + ngày hạn** cho cơ hội đang mở | Thông báo ngay + **Hoàn tác một cú bấm trong 7 ngày** + ghi vết hai chiều. Không đè lên ô do người gõ | T-6, T-7 |
| **4 · Tự ghi, không hỏi ai** | Vòng quét tự thêm **mục dòng thời gian** cho công ty Đang theo dõi | Nhãn "do hệ thống thêm" + câu trích + Sales xoá được + Nhật ký vòng quét từng vòng | T-8 |
| **✋ Cấm tuyệt đối** | — | Không đổi giai đoạn · không đánh Thắng/Thua · không sửa giá trị tiền · không liên hệ khách · không xoá dữ liệu người tạo | T-10 |

Ba luật xuyên suốt bốn vùng:

- **Vùng 3 và 4 là ngoại lệ do Specs mở, không phải mặc định.** Thêm bất kỳ chỗ nào AI tự ghi ngoài hai chỗ này = vi phạm, phải có ADR mới.
- **Vùng cấm phải chặn được cả khi lệnh không đến từ giao diện** — enforce ở tầng domain (`actor=system` không có quyền) **và** ràng buộc CSDL. Một lời dặn dò suông với phần AI không tính là đã chặn.
- **Có nút tắt sạch vùng 1–4**, hiệu lực ngay, dữ liệu đã sinh không bị xoá (T-9).

Danh sách đầy đủ nằm trong [docs/ontology.md](docs/ontology.md) và phải có test chứng minh nó bị chặn thật.

## 5. Quy trình làm việc với AI (áp dụng cho cả 5 giai đoạn)

Một vòng chuẩn — làm đúng vòng này là chạm mức 4 của rubric:

```
1. Cho AI PHẢN BIỆN trước khi làm   → /hack:req-challenge hoặc /hack:design-challenge
2. Đọc, cãi lại, chọn                → người quyết định, không bấm accept mù
3. Ghi ADR kèm PHƯƠNG ÁN BỊ LOẠI     → /hack:adr
4. Mới bắt tay code
5. Output AI vào sản phẩm → có người verify + ghi cách verify vào ADR
```

Bắt buộc:

- **Mọi quyết định không tầm thường đều có ADR.** Không có ADR = quyết định đó không tồn tại với BGK. Xem [docs/decisions/README.md](docs/decisions/README.md).
- **Lưu prompt log** phiên phản biện vào `docs/ai-sessions/`. Đây là bằng chứng minh bạch (bonus) và là đề thi vòng 2.
- **Telemetry Claude Code phải bật** trên máy mọi thành viên trước khi gõ dòng đầu tiên. Không log = không điểm.
- Ưu tiên **agentic**: để AI tự chạy nhiều bước, tự chạy test, tự sửa lỗi. Ưu tiên gọi qua custom tool/MCP của đội thay vì copy-paste.

## 6. Convention

> **Luật chung của mã nguồn: [docs/code-standards.md](docs/code-standards.md).** Đọc trước khi gõ dòng code đầu tiên trong `apps/` hoặc `packages/`. Mục này chỉ giữ phần tra cứu nhanh.

- **Stack:** pnpm monorepo (Node 22, TypeScript 5.7 strict) — `apps/api` NestJS 11 + Drizzle + Postgres 16 · `apps/web` Next 15 App Router (standalone) + React 19 + Tailwind v4 + TanStack Query · `packages/contracts` zod + enum dùng chung · `packages/db` schema/migration/seed. Caddy + docker compose ở `infra/`.
- **Test:** Vitest (unit + integration) · Playwright (e2e) · `pnpm test` chạy cả hai.
- **Ngôn ngữ mã nguồn:** code và comment **tiếng Anh**; chỉ chuỗi hiển thị cho người dùng (nhãn enum, thông báo lỗi Sales đọc, đoạn URL) giữ **tiếng Việt**. Docs và plan viết tiếng Việt.

| Việc | Lệnh |
| --- | --- |
| install | `pnpm install` |
| dev (chỉ bật Postgres, app chạy tay) | `pnpm dev` |
| chạy cả hệ thống bản production (1 cổng `:8080`) | `pnpm start` |
| tắt · tắt và xoá sạch dữ liệu | `pnpm stop` · `pnpm reset` |
| test | `pnpm test` · `pnpm test:unit` · `pnpm test:e2e` — `test:e2e` cần stack đang chạy ở `:8080` và `pnpm exec playwright install chromium` một lần |
| lint · typecheck · build | `pnpm lint` · `pnpm typecheck` · `pnpm build` |
| CSDL | `pnpm db:generate` · `pnpm db:migrate` · `pnpm seed` |

**Cấm** thêm `db:push` của drizzle-kit vào `package.json` — nó xoá GRANT theo cột của ADR-0010.

Quy tắc không phụ thuộc stack:

- File > 200 dòng thì cân nhắc tách. Kiểm tra module đã có trước khi tạo mới.
- Đặt tên file **kebab-case, dài và tự mô tả** (JS/TS/shell); tôn trọng convention ngôn ngữ khác (Python/Go snake_case).
- **Tên file luôn tiếng Anh, không dấu.** Không đặt tên file bằng tiếng Việt kể cả không dấu (`dang-nhap.spec.ts` ❌ → `login.spec.ts` ✅). Ngoại lệ duy nhất: **thư mục route của Next App Router** — nó chính là đoạn URL Sales nhìn thấy nên giữ tiếng Việt (`app/dang-nhap/`, `app/cong-ty/`). Docs và plan trong `docs/`, `plans/` không thuộc luật này.
- Tên biến/bảng/endpoint dùng đúng từ vựng ontology ở mục 3.
- Không mock, không fake data để qua test. Sample data demo để riêng `seed/`, đánh dấu rõ là seed.
- Không commit secret, `.env`, token, key.

**Commit:** conventional commit, không nhắc tới AI trong message.

```
feat(proposal): thêm hàng đợi duyệt kèm nút accept/reject
fix(provenance): claim mất source_id không được render
docs(adr): ADR-0004 chọn cơ chế lưu observation snapshot
```

## 7. Definition of Done

Một thay đổi chỉ xong khi:

- [ ] Có test cho hành vi vừa thêm, chạy xanh
- [ ] Nếu hiển thị nhận định của AI: có provenance bấm ra được nguồn
- [ ] Nếu là proposal: có chỗ accept/reject và có ghi nhận vào metric
- [ ] Quyết định kiến trúc/nghiệp vụ phát sinh đã có ADR
- [ ] **Có ít nhất 1 người ngoài người viết hiểu và giải thích lại được**

## 8. Cấm

- ❌ Chatbot đính bên cạnh CRUD rồi gọi là AI-native
- ❌ Hiển thị nhận định không nguồn — thà bỏ tính năng còn hơn. *Một tính năng đúng 8/10 lần nhưng không chỉ được nguồn thì tệ hơn không có nó.*
- ❌ Bấm accept output AI mà không hiểu → đúng cái bẫy vòng 2 bắt
- ❌ Thêm feature để khoe số lượng. Rubric thưởng **hành vi**, không thưởng số feature
- ❌ Ontology viết trong file md nhưng code không đọc → trang trí
- ❌ Làm việc mà quên bật telemetry
