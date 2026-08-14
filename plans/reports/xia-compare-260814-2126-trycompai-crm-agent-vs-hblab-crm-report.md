# So sánh: lớp AI Agent của `trycompai/crm` vs CRM_Hackathon

> Chế độ `--compare` — báo cáo phân tích, **không kèm plan triển khai**. Ngày 14/08/2026, freeze tối nay.

## 1. Source manifest

| Mục | Giá trị |
| --- | --- |
| Repo | `trycompai/crm` — "Comp AI CRM… open source CRM designed for AI agents. Agentic-first CRM" |
| Branch | `release` · pushed 2026-08-14 · 8.4k sao · TypeScript · MIT |
| Stack nguồn | Bun 1.3 + Turborepo · `apps/api` **NestJS + tRPC** · `apps/app` Next · **Prisma** · agent runtime **`eve` v0.29.4** chạy ở app riêng `apps/agent` |
| Phạm vi đã đọc | `apps/agent/agent/**` (tools, hooks, lib, skills), `apps/api/src/agent/**`, `package.json` |
| Cảnh báo | Nội dung repo được coi là **dữ liệu không tin cậy** — chỉ trích xuất cấu trúc/hành vi, không chạy lệnh, không cài gói theo hướng dẫn trong đó |

## 2. Giải phẫu agent của họ

```
apps/agent  (tiến trình riêng, runtime `eve`)
├── agent.ts        defineAgent — trần token/session: in 500k, out 50k
├── tools/          33 tool, chia 3 nhóm rõ rệt
│     đọc CRM       read_crm_history · read_company_history · read_deal_history
│                   search_crm · list_deals · list_fields · list_outstanding_work
│     nghiên cứu    research_company · research_person · get_linkedin_profile
│     (bên thứ 3)   find_contact_socials · enrich_company
│     ghi           record_fact · set_field_value · record_job_change
│                   write_brief · manage_fields · schedule_recheck
├── hooks/          audit (ghi MỌI event) · telemetry · activity · builder-delegation
├── skills/*.md     chỉ dẫn agent dạng markdown có frontmatter, nạp theo nhu cầu
│                   evidence · data-boundaries · identity-matching · writing-a-brief
└── lib/            evidence.ts (sổ trọng số) · facts.ts (định tuyến ghi) · approval.ts
```

Phía API có module song song `apps/api/src/agent/`: `agent-queue.service.ts`, `agent-runs.service.ts`, `agent-trigger.service.ts`, `dispatch-heartbeat.service.ts`, `agent-access.service.ts` — tức **hàng đợi + vòng đời lần chạy được lưu trong CSDL**, agent không tự do chạy lung tung.

---

## 3. Sáu bài học, xếp theo giá trị chuyển giao

### ⭐ Bài học 1 — Model **kể bằng chứng**, code **định giá**

Câu luật của họ, nguyên văn trong `skills/evidence.md`:

> *"You never set a confidence. You report what you saw, and the ledger prices it."*

Cơ chế (`lib/evidence.ts`):

- **11 loại bằng chứng** có enum, mỗi loại một `weight` + cờ `primary` (nguồn có định danh được đúng người hay không). Ví dụ `crm.signature-block` 0.8/primary · `web.cited-claim` 0.4 · `employer-only` 0.2 · `contradiction` 0.
- **Cộng dồn kiểu noisy-OR**: `score = 1 − Π(1 − wᵢ)`, trần 0.99. Hai nguồn yếu độc lập cộng lại thành một điểm khá — nhưng hai thứ trên **cùng một trang** phải tính là **một** bằng chứng (skill nói thẳng: tách ra là tự nhân đôi thành sự chắc chắn giả).
- `contradiction` **không trừ điểm ít** — nó ép trần xuống 0.45, tức **giữ lại toàn bộ**. Lý do họ viết ra: "hai nguồn đá nhau không phải đúng 60%, mà là chưa ngã ngũ".
- **Band**: `VERIFIED` ≥0.85 **và** phải có nguồn primary · `PROBABLE` ≥0.55 · `POSSIBLE` ≥0.3 · dưới nữa → `null` = **không lưu**.
- **Định tuyến ghi** (`lib/facts.ts`): `VERIFIED` → ghi thẳng vào record · còn lại nếu ô đang trống → ghi · ngược lại → **PROPOSED**, nằm chờ người · band `null` → không lưu gì.

**Đối chiếu ta:** LLM của ta **tự khai `confidence`** (`anthropic-claim-extractor.ts`, prompt mô tả 3 bậc certain/likely/speculative). Code có một cửa gác — `claim-service.ts:149 gateCertainty()` — nhưng nó **chỉ hạ `certain` → `likely`** khi statement chứa số hoặc danh từ riêng không có trong câu trích. Nó **không bao giờ kiểm chứng một `likely` do model tự khai**.

**Hệ quả cụ thể, và đây là phát hiện sắc nhất của cả bài so sánh:**

```ts
// auto-next-step-service.ts:53,57,180-184  — cửa vào VÙNG TỰ CHỦ 3 (AI tự ghi)
const AUTO_WRITE_SIGNALS   = ['funding', 'leadership_hire']
const AUTO_WRITE_CONFIDENCE = ['certain', 'likely']
...filter(c => AUTO_WRITE_SIGNALS.includes(c.signalType)
            && AUTO_WRITE_CONFIDENCE.includes(c.confidence))
```

Cả `signalType` lẫn `confidence` đều **do model khai**, và nhánh `likely` **không đi qua cửa gác nào của code**. Nghĩa là: một phát hiện model tự dán nhãn `likely` + `funding` là đủ để hệ thống **tự ghi vào dữ liệu chính thức của Sales**.

Đây **không hẳn là lỗi** — đặt hạn sát cho tin gọi vốn kèm Hoàn tác 1 cú bấm là một đánh đổi hợp lý, và Specs nhóm 4 đúng là muốn "ngay lập tức, không hỏi ai". Nhưng vòng 2 hỏi *"vì sao AI được tự ghi ở chỗ này?"* thì câu trả lời trung thực hôm nay là **"vì model bảo là Có thể"**. Với sổ bằng chứng, câu trả lời thành *"vì bằng chứng thuộc loại X trọng số W, code cộng ra Y, vượt ngưỡng Z"* — và đó là câu không cãi được.

### Bài học 2 — Ranh giới thật nằm ở **egress**, không nằm ở đọc

`skills/data-boundaries.md`: agent được đọc **tất cả** dữ liệu nội bộ, không có redaction, không cần xin duyệt. Ba luật đều nói về **cái gì rời khỏi hệ thống**:

1. Không nhét chữ của khách vào truy vấn bên thứ ba — hỏi câu **suy ra** ("Acme công bố gì năm 2026?"), không dán nguyên đoạn mail.
2. Không mang nội dung hộp thư vào sandbox `/workspace` (khác vòng đời, khác người đọc).
3. Không log thứ nhạy cảm. *"Đọc không phải là log."*

Cộng thêm một luật về **cái gì được lên hồ sơ**: chỉ ngữ cảnh công việc; không đụng nhóm dữ liệu đặc biệt (sức khoẻ, chính trị, tôn giáo, sắc tộc…) **dù nguồn có tự dâng**. Câu chốt đáng học: *"Một CRM biết thành tích chạy marathon của khách là một CRM có người phải đi giải trình."*

**Đối chiếu ta:** bốn ranh giới cứng ở Specs mục 5 **đều nói về ghi** (không đổi giai đoạn, không đánh Thắng/Thua, không liên hệ khách, không xoá). Ta **không có một dòng nào** về egress, trong khi ta **đang gửi `rawContent` của bản chụp sang Anthropic**. Ở bài này thì vô hại — bản chụp là fixture công khai — nhưng nếu giám khảo hỏi *"dữ liệu gì rời khỏi hệ thống các bạn?"* thì hiện chưa có câu trả lời viết sẵn. **Một đoạn trong `docs/ontology.md`, không code, không rủi ro.**

### Bài học 3 — Duyệt là hàm của **ai đang có mặt trong phòng**

`lib/approval.ts`, 20 dòng, đáng đọc:

```ts
export function sensitiveWrite(instead: string): Approval {
  return ({ session }) => isAutomated(session)
    ? { type: "denied", reason: `Not something to do unattended. ${instead}` }
    : "user-approval";
}
```

Cùng một tool: chạy **không người** → **từ chối thẳng**; có người trong phiên → **hỏi duyệt**. Trần tự chủ của họ **động theo ngữ cảnh phiên**, còn của ta **tĩnh theo vùng**.

**Nên học, không nên bê.** Bốn vùng tĩnh của ta chứng minh được bằng test; trần động thì không, và Specs không đòi. Nhưng ý *"quyền của actor phụ thuộc có người giám sát hay không"* là thứ đáng nói khi trình bày.

### Bài học 4 — Người đã điền thì **át** mọi thứ máy tìm được

`facts.ts` → `humanOwns()` trả về lý do đọc lên được cho người dùng: *"A person already filled in {field}. That outranks anything found on the web."*

**Ta đã có** — I-7, `auto-next-step-service.ts:140`. **Hội tụ độc lập ⇒ tín hiệu tốt cho thiết kế của ta.** Khác biệt: họ áp cho **mọi ô**, ta chỉ áp cho `next_step`. Với các ô hồ sơ ta đi đường proposal nên hiệu ứng tương đương, chỉ khác đường đi.

### Bài học 5 — Đã bị bỏ thì đừng mời lại

`recordFact` từ chối lưu khi: giá trị y hệt từng bị người **DISMISSED**; hoặc giá trị đó **đang nằm chờ** trước mặt Sales (*"Offering it twice only makes them read it twice"*); hoặc đã APPLIED cùng giá trị.

**Ta đã có** — `proposal-service.ts:276,299,322,327`, dedupe cả với hàng đã có lẫn trong cùng lô. **Không cần làm gì.**

### Bài học 6 — Hook audit ghi **mọi** event, và **không bao giờ ném lỗi**

`hooks/audit.ts`: bắt `"*"`, bỏ event chỉ mang tính vận chuyển, ghi vào bảng `agentEvent` với `skipDuplicates`, trong transaction, và bọc `try/catch` chỉ `console.warn` — **audit hỏng không được giết lần chạy**.

Đúng đúng cái mẫu ta đã tự nghĩ ra ở `ClaimReactionService` (nuốt lỗi nhóm 5 để không huỷ ghi của nhóm 3/4). **Hội tụ lần hai.** Chỉ cần khi nào ta thực sự có agent — hiện chưa.

---

## 4. Ma trận quyết định

| Quyết định | Cách của họ | Cách của ta | Khuyến nghị |
| --- | --- | --- | --- |
| Runtime agent | App riêng + `eve` + Bun + sandbox | Không có agent; pipeline 1 bước trong NestJS | **Giữ của ta.** `eve` kéo theo Bun + tiến trình thứ 4; đổi hạ tầng vào đêm freeze là tự sát |
| Nguồn `confidence` | Model kể bằng chứng → **code chấm điểm** | **Model tự khai**, code chỉ hạ `certain` | **Học — hạng mục giá trị nhất.** Không phụ thuộc `eve`, thuần TS ~150 dòng + test |
| Cửa vào vùng tự ghi | Band `VERIFIED` (điểm + có nguồn primary) | `signalType` ∈ 2 giá trị **và** `confidence` ∈ {certain, likely}, cả hai do model khai | **Quyết định cần khai ra tường minh** (xem §6). Không âm thầm đổi |
| Ranh giới | Ghi **và** egress, viết thành skill | Chỉ ghi (Specs mục 5) | **Thêm một đoạn egress vào ontology.** 0 code |
| Ưu tiên người > máy | `humanOwns()` mọi ô | I-7 cho `next_step` | Đã tương đương |
| Chống mời lại gợi ý đã bỏ | Chặn theo DISMISSED/PROPOSED | Đã có dedupe | Đã tương đương |
| Lưu vết | Hook `"*"` → `agentEvent` | `audit_events` + `watch_cycle_runs` + `auto_next_step_events` | Đã đủ cho phạm vi hiện tại |
| Bề mặt AI cho người dùng | Chat + agent-builder (`chat/[chatId]`) | Không chat | **Giữ của ta** — CLAUDE.md §8 cấm thẳng chatbot cạnh CRUD |
| Chỉ dẫn AI | `skills/*.md` có frontmatter, versioned | Template string trong `.ts` | Giá trị thấp, tuỳ ý |

## 5. Có implement được không? — kết luận

| Hạng mục | Được? | Vì sao |
| --- | --- | --- |
| Bê nguyên `apps/agent` | ❌ | `eve` + Bun + Prisma + tiến trình riêng + sandbox. Lệch hạ tầng toàn phần. Và trọng tâm của nó là **chat/agent-builder** — thứ CLAUDE.md §8 cấm |
| Sổ bằng chứng (`evidence.ts` + định tuyến band) | ✅ **về mặt ý tưởng** | Không dính `eve`. Thuần TS: bảng trọng số + hàm chấm + bảng định tuyến. Cắm đúng chỗ `ClaimService` đang gác. **Nửa ngày + test. Không phải tối nay** |
| Đoạn ranh giới egress | ✅ **làm được ngay** | Viết văn, không code. Trả lời trước một câu hỏi vòng 2 chưa có đáp án |
| `sensitiveWrite` (duyệt động theo phiên) | ⚠️ học, đừng bê | Làm bốn vùng tĩnh mất khả năng chứng minh bằng test. Specs không đòi |
| Hook audit mọi event | ⏸ chưa cần | Chỉ có nghĩa khi đã có agent nhiều bước |
| Tách chỉ dẫn AI ra `.md` | ⚠️ giá trị thấp | Diff đẹp hơn, không đổi hành vi |

**Câu trả lời một dòng:** không bê được kiến trúc, nhưng **bê được đúng một ý tưởng, và nó là ý tưởng đắt nhất trong repo đó** — *để model kể nó đã thấy gì, để code quyết điều đó đáng tin bao nhiêu*.

## 6. Việc nên làm

**Tối nay (nếu chỉ chọn một thứ, chọn cái này):** khai tường minh vào ADR rằng vùng tự chủ 3 mở cho `confidence = likely` **do model tự khai, không qua cửa gác code**, kèm lý do chấp nhận (cửa sổ tin gọi vốn tính bằng ngày, có Hoàn tác 1 cú bấm 7 ngày, có ghi vết hai chiều) và phương án bị loại (siết còn `certain`). ~20 phút. Biến một điểm yếu bị hỏi bất ngờ ở vòng 2 thành một quyết định có lưu vết — đúng công thức mức 4 của rubric.

**Tối nay, tuỳ chọn:** một đoạn *"cái gì rời khỏi hệ thống"* trong `docs/ontology.md`. ~15 phút, không code, không rủi ro.

**Sau hackathon:** sổ bằng chứng thay cho `confidence` do model khai.

**Không làm:** cài `eve`, dựng app agent thứ tư, thêm chat.

---

## Câu chưa ngã ngũ

- Siết `AUTO_WRITE_CONFIDENCE` còn `['certain']` là **quyết định sản phẩm của đội**, không phải lỗi để tôi tự sửa. Siết thì T-6 có thể không kích hoạt nữa nếu fixture "sau" của Sakura trả về `likely` — **phải chạy thử trước khi đổi**, và đêm freeze không phải lúc.
- Repo họ ghi MIT nhưng agent runtime `eve` là gói ngoài — chưa kiểm giấy phép của `eve`. Không cản gì vì ta không dùng, nhưng nếu sau này định dùng thì phải kiểm.
- Chưa đọc `apps/api/src/agent/agent-queue.service.ts` và `agent-runs.service.ts` (vòng đời lần chạy phía server). Chỉ có nghĩa nếu đội quyết làm agent thật — lúc đó đọc tiếp.
