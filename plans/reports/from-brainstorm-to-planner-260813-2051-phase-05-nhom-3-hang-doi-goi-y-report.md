# Phase 5 — Nhóm 3 hàng đợi gợi ý: thiết kế chốt

| | |
| --- | --- |
| **Ngày** | 2026-08-13 20:51 |
| **Phạm vi** | [phase-05-nhom-3-hang-doi-goi-y.md](../260813-0107-feature-groups-1-6-and-acceptance-suite/phase-05-nhom-3-hang-doi-goi-y.md) |
| **Người quyết định** | HungLV |
| **Cách kiểm** | đọc mã nguồn (schema, contracts, migration GRANT, service, seed, bản chụp), **không** chạy đo |
| **Kết quả** | 4 quyết định chốt · 3 ADR phải viết · phase file phải sửa ở 6 chỗ |

## 1. Vấn đề

Phase 5 viết trước khi P2 xong, nên giả định "claim mới → sinh Proposal" là chuyện nối dây. Đọc code thật thì **ba chỗ không nối được**, và một chỗ trong đó làm hàng đợi trống rỗng lúc demo.

## 2. Điểm khởi đầu — cái gì đã có

Xác minh bằng đọc file, kèm vị trí:

| Thứ | Trạng thái | Vị trí |
| --- | --- | --- |
| Bảng `proposals` + CHECK ép I-11 hai nửa (whitelist **và** cấm `name`/`company_type`), index `(status, created_at)` | **đã có** | `packages/db/src/schema/proposals.ts:51-58` |
| `status` **vắng** khỏi `GRANT INSERT` của `crm_system` ⇒ T-4 có lớp chặn CSDL | **đã có** | `packages/db/migrations/0003_grants_ai_tables.sql:36-40` |
| `proposal_decisions` — `crm_system` **không có GRANT nào** | **đã có** | cùng file, dòng 46 |
| `decideProposalSchema` đã encode ADR-0008 (`reject` ⇒ bắt buộc lý do) + I-12 (`edit` ⇒ bắt buộc `finalValue`) | **đã có** | `packages/contracts/src/dto/proposal.ts` |
| `CompanyService.update(actor, …)` từ chối `actor.kind === 'system'` | **đã có** | `apps/api/src/domain/company/company-service.ts:86-88` |
| Bốn ô whitelist đều `text` tự do (không enum bucket) | **đã có** | `packages/db/src/schema/companies.ts:24-28` |
| Đường sinh `Claim` duy nhất: `ObservationService.ingest()` → `ClaimService.saveDrafts()` | **đã có**, file của **A** | `apps/api/src/domain/observation/observation-service.ts:121-130` |
| `apps/web` có vitest project | **KHÔNG** | `vitest.config.mts` chỉ `packages/*` + `apps/api` |

⇒ **P5 không phải việc schema.** Là service + wiring + UI, cộng đúng một migration nhỏ (mục 4.2).

## 3. Ba lỗ hổng phát hiện được

### 3.1. Không có đường honest nào từ `Claim` → `field_update`

`ClaimDraft` = `{statement, signalType, confidence, quoteText}` — **không có cặp (ô, giá trị)** ở bất kỳ đâu trong pipeline. Bản chụp trong `apps/api/src/ai/demo-snapshots.ts` không có dòng dữ kiện hồ sơ nào. Seed đã điền đủ `industry/country/size/website` cho 4/5 công ty; công ty duy nhất `website: null` là **Ohara — cố tình không đọc được** (`rawHtml: ''`, dùng để diễn ca `fetch_status = failed`).

Suy `country = 'Nhật Bản'` từ claim Kitefin *"mở rộng sang thị trường Nhật Bản"* là **ghi một dòng dữ liệu sai** (Kitefin trụ sở Hoa Kỳ) — vi phạm luật 4 CLAUDE.md.

### 3.2. I-5 làm hàng đợi trống trong demo

Seed có 3 công ty `is_watched = true` (Sakura · Nimbus · Kitefin) ⇒ I-5 chặn `timeline_entry` cho **cả ba**. Còn lại Marlin (không theo dõi, đọc được) và Ohara (không theo dõi, không đọc được). Cộng với 3.1: hàng đợi có tối đa **một** thẻ, từ đúng công ty mà plan ghi là "cắt đầu tiên". Giám khảo mở hàng đợi ra không thấy gì.

### 3.3. Proposal của I-7 không lưu được

`proposal_type ∈ {field_update, timeline_entry}`, CHECK buộc `field_update` nhắm vào 4 ô hồ sơ. ADR-0005/I-7 nói gặp ô `next_step_source = human` thì **sinh Proposal**. Không type nào chứa nó. Ép sang `timeline_entry` thì Sakura (đang theo dõi) lại bị I-5 chặn — đúng kịch bản plan mô tả cho Sakura.

Thêm một tầng: `proposals` **không có `opportunity_id`**, mà Việc tiếp theo thuộc **cơ hội** chứ không thuộc công ty.

## 4. Bốn quyết định chốt

### 4.1. `field_update`: LLM đề xuất, code giữ ba cửa chặn *(kết hợp A + B)*

Phương án bị loại: chỉ tất định (LLM không có phần việc "hiểu ngữ cảnh" nào, mà đây đúng là chỗ Specs đòi) · chỉ LLM (không có dữ kiện trong bản chụp thì mọi đề xuất đều là bịa) · cắt `field_update` (mất một gạch đầu dòng Specs, cộng 3.2 thì hàng đợi còn 1 thẻ).

**Ba việc, theo thứ tự:**

1. **Bản chụp có dữ kiện để trích.** `demo-snapshots.ts` thêm một khối dữ kiện thật của trang công ty, giá trị **trích nguyên văn được**: `Trụ sở chính: Aichi, Nhật Bản · Quy mô: 500-1000 nhân viên · Ngành: Sản xuất linh kiện chính xác · Website: …`. Không có khối này thì LLM chỉ còn cách bịa.
2. **LLM quyết cái gì đáng đề xuất.** Prompt nhận thêm **giá trị hiện tại của 4 ô** và trả thêm `fieldSuggestion` tuỳ chọn `{targetField, proposedValue}`. Đây là phần "hiểu ngữ cảnh": chọn ô nào, cắt phần nào của dòng dữ kiện ra làm giá trị.
3. **Code không tin LLM — ba cửa chặn:**

| Cửa | Nội dung | Không qua thì |
| --- | --- | --- |
| **G1** | `targetField` ∈ `{industry, country, size, website}` | từ chối ở service **và** CHECK CSDL (hai lớp, đã có) |
| **G2** | `proposedValue` là **chuỗi con nguyên văn** của `quoteText` (mà `quoteText` đã qua I-2 ⇒ nguyên văn của `raw_content`) | **bỏ `fieldSuggestion`, giữ claim** — claim vẫn có giá trị đọc độc lập. Đếm + log như `droppedNoVerbatimQuote` |
| **G3** | `currentValue` (đọc từ hồ sơ, **code đọc**) khác `proposedValue` sau trim | không sinh proposal. Đây là chỗ ép "chỉ ô trống hoặc đã cũ", không tin LLM tự nói |

Vì bốn ô đều `text` tự do (mục 2), G2 áp được cho cả bốn — **không có ngoại lệ nào cho `size`**, tức không có kẽ hở nào để trôi thành "gần đúng".

4. **`impact_if_wrong` do code sinh theo bảng cố định theo `targetField`**, không nhờ LLM. Một dòng thật cho từng ô, ví dụ `country` → *"Sai quốc gia trụ sở thì bộ lọc theo thị trường trả danh sách sai, và người phụ trách thị trường nhận sai deal."* Đóng luôn rủi ro "`impact_if_wrong` bị điền cho có" mà phase file đã nêu — không còn ca chuỗi rỗng nào tồn tại được.

**Yêu cầu dữ liệu kèm theo (chặn 3.2):** phải có **≥1 ô trống và ≥1 ô đã cũ trên công ty đang theo dõi**, để hàng đợi demo không phụ thuộc Marlin (công ty đầu danh sách cắt). Đề xuất: `size` của Sakura đổi ở bản `after` (ca "đã cũ", Sakura watched ⇒ đồng thời chứng minh I-5 vẫn cho `field_update`) + một công ty watched có `website: null` trong seed (ca "ô trống", sửa 1 dòng `seed-data.ts` — file của C).

### 4.2. I-7: thêm `proposal_type = next_step` + cột `opportunity_id`

Phương án bị loại: sinh thông báo suông (đảo ADR-0005 và bỏ đường ngược nhóm 4 → nhóm 3 mà chính ADR đó ghi là hệ quả) · đẩy sang P6 (P5 sở hữu UI hàng đợi ⇒ phát sinh vào tối 14/08 lúc freeze).

Migration gồm:

- `proposal_type` thêm giá trị `next_step`.
- Cột `opportunity_id uuid NULL` → `opportunities.id`.
- CHECK mở rộng thành ba nhánh: `field_update` ⇒ `target_field` ∈ whitelist ∧ `opportunity_id IS NULL` · `timeline_entry` ⇒ cả hai NULL · `next_step` ⇒ `target_field = 'next_step_text'` ∧ `opportunity_id IS NOT NULL`.
- **`GRANT INSERT (opportunity_id) ON proposals TO crm_system`** — cột mới không tự được phủ, đúng luật 3 của plan. Kèm **phép đo đột biến**: bỏ dòng GRANT này ⇒ sinh `next_step` proposal phải thất bại.
- I-11 giữ nguyên nghĩa: **whitelist ô *hồ sơ công ty***. Ghi rõ trong ADR để vòng 2 không đọc thành nới lỏng I-11.

**Ngày hạn không cần cột mới:** tính từ **ngày duyệt** + bảng độ gấp I-9 theo `signal_type` của claim. Hợp lý hơn tính từ lúc sinh gợi ý, vì gợi ý có thể tồn nhiều ngày trong hàng đợi.

**Duyệt `next_step` ghi `next_step_source = 'human'`.** Nếu ghi `'system'` thì ô rơi vào vùng tự chủ 3 và kéo theo thông báo + Hoàn tác 7 ngày — sai vùng: đây là người bấm.

### 4.3. `ClaimReactionService` — một chỗ nối, không ba

`observation-service.ts` là file của A mà P5, P6, P7 đều cần nối vào; I-7 lại buộc thứ tự **nhóm 4 chạy trước, gặp ô người gõ thì gọi sang nhóm 3**.

```
ObservationService.ingest()  ──1 dòng──►  ClaimReactionService.react(observationId, companyId, claims)
                                              │ 1. nhóm 4 (P6) — tự đặt Việc tiếp theo
                                              │    trả về danh sách claim bị I-7 chặn
                                              └ 2. nhóm 3 (P5) — sinh Proposal
                                                   (+ next_step cho danh sách bị chặn)
P7 vòng quét ────────────────────────────────►  cùng một service
```

Phương án bị loại: gọi trực tiếp trong `observation-service.ts` (ba phase sửa cùng một hàm của A trong hai ngày cuối) · Nest EventEmitter (fire-and-forget làm test flaky và **thứ tự I-7 không quan sát được**).

P5 tạo file này với **chỉ bước 2**. Không viết interface rỗng hay stub cho P6 — P6 tự thêm dòng của mình vào đúng chỗ, thứ tự ghi trong comment.

### 4.4. T-4 integration, T-5 e2e mỏng

T-4 chạy Vitest trên `crm_test` + fake timer (tiền lệ `apps/api/src/watch/__tests__`): sinh proposal → 3 tick → `SELECT` chứng minh hồ sơ y nguyên. Chờ 3 phút thật trong Playwright là đổi độ tin cậy lấy hình thức. T-5 e2e mỏng cho ba nút. `apps/web` **vẫn không có vitest project** — nợ có chủ ý, giống P3.

## 5. Hai điểm chốt kèm, không cần hỏi riêng

- **Không sinh lại gợi ý đã Bỏ:** lớp một là I-3 (bản chụp không đổi ⇒ không có `Observation` mới ⇒ không có claim mới ⇒ không có gì để sinh). Lớp hai: so `(company_id, proposal_type, target_field, proposed_value)` với các proposal đã `reject`, và **chỉ mở lại khi claim đến từ `Observation` mới hơn** cái đã bị Bỏ. Đúng chữ Specs *"trừ khi có bản lưu mới"*.
- **Dấu hiệu chờ duyệt:** `GET /proposals/pending-summary` trả map `companyId → count`, không phình `CompanyDto`/`OpportunityDto`. Danh sách cơ hội cần badge theo công ty nên map là dạng rẻ nhất cho cả hai màn.

## 6. Áp thay đổi khi Duyệt

| Loại | Duyệt ⇒ | Ghi bằng |
| --- | --- | --- |
| `field_update` | `CompanyService.update(actor, companyId, { [targetField]: value })` | có sẵn, đã từ chối `actor=system` |
| `timeline_entry` | `TimelineService` — `created_by = human`, `entry_type = note`, kèm câu trích | vùng 2 là **người** ghi, nên **không** mang nhãn "do hệ thống thêm" (nhãn đó của vùng 4/nhóm 5) |
| `next_step` | `next_step_text = value` · `next_step_due_date = ngày duyệt + I-9(signal_type)` · `next_step_source = 'human'` | không vào vùng 3 ⇒ không thông báo, không Hoàn tác 7 ngày |

`edit` đi cùng đường với `accept` nhưng ghi `final_value`, và **`decision = 'edit'`** — I-12 tự đúng vì `accept`/`edit` là hai giá trị enum khác nhau, không có cột thứ hai nào để cộng nhầm.

## 7. Bộ test

| Mã | Nội dung | Tầng |
| --- | --- | --- |
| **T-4** | sinh proposal → 3 tick → hồ sơ y nguyên · `status` vẫn `pending` · 0 dòng `proposal_decisions` | integration |
| **T-5** | ba nhánh đều có bản ghi ai/lúc nào/quyết gì; `edit` **không** cộng vào `accept` | e2e mỏng + integration |
| **I-5** | công ty watched + claim ⇒ **không** `timeline_entry`, **có** `field_update` | unit/integration |
| **I-11** | `targetField = 'company_type'` bị service từ chối **và** raw `INSERT` bị CHECK từ chối | hai lớp |
| **I-12** | đếm `edit` riêng | integration |
| **G2** | `proposedValue` không nằm trong quote ⇒ bỏ suggestion, **claim vẫn lưu** | unit |
| **G3** | `currentValue == proposedValue` ⇒ không sinh | unit |
| — | đã Bỏ: 3 tick không quay lại; `Observation` mới ⇒ quay lại **được** | integration |
| — | tắt AI ⇒ hàng đợi tồn **vẫn duyệt được** (ADR-0009) | integration |
| — | đếm bước: Bỏ (1) ≤ Duyệt (1); Sửa rồi duyệt (2) | e2e |

**Ba phép đo đột biến:** xoá dòng kiểm I-11 ⇒ đỏ · `GRANT INSERT (status)` cho `crm_system` ⇒ lớp CSDL của T-4 đỏ · bỏ `GRANT INSERT (opportunity_id)` ⇒ sinh `next_step` thất bại.

## 8. ADR phải viết

| # | Nội dung |
| --- | --- |
| ADR-0023 | `proposal_type = next_step` + cột `opportunity_id`; I-11 vẫn chỉ nói về ô hồ sơ công ty; ngày hạn tính lúc duyệt; `next_step_source = human` |
| ADR-0024 | `field_update` = LLM đề xuất + ba cửa chặn code + khối dữ kiện trong bản chụp; `impact_if_wrong` do code sinh |
| ADR-0025 | Mốc `seconds_to_decide` **đặt lại sau mỗi quyết định** thay vì một mốc chung lúc mở màn hình — với thẻ thứ hai trở đi thì "lúc mở màn hình" làm trung vị vô nghĩa. Không xung đột ADR-0008 (ADR đó chỉ nói mốc **kết thúc** là lúc chọn lý do); **có sửa ontology mục 7** |

## 9. Ước lượng và chỗ không vừa

Phase file ghi **3h**. Cộng thật: `+45–60'` cho migration `next_step` + `opportunity_id` + GRANT + phép đo, `+30'` cho khối dữ kiện bản chụp + prompt, `+20'` cho 3 ADR ⇒ **~4.5h**, nằm trên vai B và trong đường găng tới P8.

Cắt theo thứ tự này nếu **trưa 14/08** chưa xong:

1. `next_step` proposal → đẩy sang P6 (A đã phải chạm `opportunities` ở phase đó).
2. Khối dữ kiện chỉ làm 2 công ty thay vì 5.
3. Dấu hiệu chờ duyệt chỉ ở màn công ty, chưa ở danh sách cơ hội.

**Không cắt:** T-4 · T-5 · ba cửa chặn G1–G3 · menu 5 lý do tại chỗ · duyệt được khi đã tắt AI.

## 10. Rủi ro

| Rủi ro | Xử lý |
| --- | --- |
| **B phải sửa 4 file của người khác**: `demo-snapshots.ts` + `anthropic-claim-extractor.ts` (A), `seed-data.ts` (C), `observation-service.ts` (A, 1 dòng), cộng `contracts/dto/claim.ts` dùng chung | Làm **sớm trong phase**, thông báo trước, pull trước push, **không refactor**. Tiền lệ ADR-0021 đã mở ngoại lệ có ý thức với bảng chủ quyền |
| LLM không trả `fieldSuggestion` nào ⇒ hàng đợi vẫn trống | G3 và khối dữ kiện làm ca này quan sát được ngay; nếu 0 suggestion trên 5 công ty thì sửa prompt trong phase, **không** hạ cửa chặn G2 |
| Migration cùng lúc với P6/P7 ⇒ đụng thứ tự file migration | B đẩy migration **đầu phase**, không cuối |
| Đếm bước Bỏ ≤ Duyệt trượt vì popover cần bấm mở | ADR-0008 đã chốt cách đọc là **số bước**; chọn lý do **chính là** thao tác bỏ, không có nút xác nhận |

## 11. Câu hỏi còn treo

- **I-4 và `timeline_entry` proposal.** I-4 cấm claim `manual_ingest` sinh `TimelineEntry`. Duyệt một `timeline_entry` proposal là **người** ghi (`created_by = human`), nên đọc là không vi phạm — nhưng chữ I-4 không nói rõ. Cần một câu trong ADR-0024 hoặc ontology, kẻo vòng 2 hỏi đúng chỗ này. *Không chặn code.*
- **Công ty watched nào nhận `website: null`** để có ca "điền ô trống". Sửa 1 dòng `seed-data.ts` (file của C) — cần C xác nhận không đụng test `seed-idempotent.test.ts`.
- Q-6 (Admin có được thao tác CRM không) vẫn treo từ plan, không chặn P5.
