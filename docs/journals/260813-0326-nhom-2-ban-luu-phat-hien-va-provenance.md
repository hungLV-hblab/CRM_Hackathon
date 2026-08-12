---
date: 2026-08-13 03:26
session: 02:46 – 03:26 (Asia/Saigon)
component: Phase 2 — nhóm 2 (bản lưu, phát hiện, provenance)
plan: plans/260813-0107-feature-groups-1-6-and-acceptance-suite
status: xong, đã commit, chưa push
adr: [0014 (trả 2/3 nợ verify), 0007, 0009, 0012, 0017]
---

# Nhóm 2: hai cửa kiểm mà phase file quên, và một e2e đỏ vì hành vi đúng

## Bối cảnh

Câu hỏi mở màn không phải "làm đi" mà "**đã start được phase 2 chưa?**". Trả lời trước khi gõ: được, nhưng có một lỗ cứng — `ANTHROPIC_API_KEY` trong `.env` là dòng rỗng (độ dài 0). Nghĩa là viết được toàn bộ nhóm 2, chạy được mọi test (fixture cắm qua port), nhưng **không chạy được phép đo thứ ba của ADR-0014**: gọi LLM thật rồi đối chiếu tay tỉ lệ câu trích nguyên văn.

Hai quyết định người chốt:

1. Làm P2 trên `FixtureClaimExtractor`, để nợ phép đo, ghi rõ trong ADR.
2. **Bỏ bảng chủ quyền A/B/C** — không có ba người song song thật, nên chồng chéo `cong-ty/[id]/page.tsx` giữa A và B không còn là vấn đề.

Kết quả: **27 file, +2166 dòng, 6 commit. 113 unit + 6 e2e xanh** (từ 88 + 3).

---

## Chuyện gì đã xảy ra

### Đường ống, tách theo đúng lằn ADR-0014

| Việc | Ai làm |
| --- | --- |
| `statement`, `signalType`, `confidence`, chọn đoạn nào để trích | LLM |
| Kiểm câu trích là chuỗi con nguyên văn | code |
| Tính `quote_start`/`quote_end` | code |
| Quyết định giữ hay bỏ | code |

`AnthropicClaimExtractor` ngắn đúng vì vậy: nó trả `ClaimDraft[]` và **không gì khác**. Không tính offset (kiểu `ClaimDraft` không có trường đó nên không có gì để nhận), không chạm CSDL, không quyết giữ hay bỏ. JSON sai hình dạng → 0 phát hiện thay vì ném lỗi: luật 4, và vòng quét không chết theo một câu trả lời lạ.

`normalizeSnapshotText` là **một** hàm dùng cho cả lúc lưu và lúc highlight. Đây là chỗ phase file ghi rủi ro "offset lệch vì chuẩn hoá hai lần khác nhau", và cách chống không phải "cẩn thận" mà là chỉ tồn tại một hàm, cộng test vòng tròn `normalise → locate → slice`. `EXTRACTOR_VERSION` nằm cùng file với hàm đó — đổi cách chuẩn hoá thì bump dòng ngay bên cạnh.

### Hai cửa kiểm mà phase file không nhắc, nhưng ADR đòi

Đây là phần đáng ghi nhất của phiên.

**Lỗ ADR-0009.** Nút tắt AI dừng *mọi* việc sinh mới. Vòng quét đã kiểm `ai_enabled`, nhưng **ingest tay là một đường sinh mới thứ hai** — phase file không nhắc, và không chặn thì T-9 có lỗ mà P8 mới phát hiện. Thêm cửa chặn đọc `system_settings` mỗi lần gọi, không cache, cùng lý do với worker.

**Cửa kiểm mức `certain` của ADR-0007.** ADR đòi mức `certain` phải có cửa kiểm bằng máy: mọi **số** và mọi **chuỗi viết hoa** trong `statement` phải có trong `quote_text`, không thoả thì hạ `likely`. Không có trong phase file. Đã cài ở `ClaimService.gateCertainty` + hai khẳng định: statement "35 triệu" với câu trích "20 triệu USD" → hạ; statement mà mọi số đều có trong câu trích → giữ `certain`.

Cả hai phase file đều **liệt kê ADR chi phối** (0014, 0012, 0003) — chỉ là liệt kê thiếu.

### Fixture không phải mock

`FixtureClaimExtractor` đọc bản chụp thật, tìm câu chứa từ khoá tín hiệu, trả **chuỗi con nguyên văn thật**. Nên nó đi qua đúng những cửa kiểm I-1/I-2 mà LLM phải đi qua. Nó chỉ không hiểu ngữ cảnh. Đây là đường lùi ADR-0014 hẹn: giám khảo không có key vẫn chạy được cả bộ nghiệm thu, và log boot nói rõ đang chạy adapter nào — "brain nào đang chạy" phải đọc được từ log, không phải đoán từ hành vi.

Adversary của T-2b **cũng không phải stub cho tiện**: một extractor paraphrase thật, mọi chữ đều có trong nguồn, chỉ **thứ tự** là không. Câu trích đó không rỗng nên I-1 cho qua — đúng chỗ chỉ I-2 bắt được.

### T-3 tự động hoá thay vì chạy tay

Phase file ghi "T-3 chạy tay". Đưa vào trình duyệt vì test service chỉ chứng minh **offset đúng**; thứ duy nhất trình duyệt chứng minh được là **cái highlight người dùng thấy được dựng từ đúng offset đó**. Một lỗi render cắt sai đoạn sẽ để mọi test backend xanh trong khi màn hình hiện provenance giả — đúng loại lỗi tệ nhất theo luật 1.

---

## Nhìn lại

### Hai lỗi thật, và cái thứ hai đáng nhớ hơn

**1 · Test sai kỳ vọng, không phải code sai.** Normalizer để `\n\n` giữa hai đoạn, tôi viết test chờ `\n`. Sửa kỳ vọng, giữ nguyên tính chất cần kiểm (hai câu không được dính nhau) và thêm một khẳng định phủ định cho chắc.

**2 · e2e đỏ vì HÀNH VI ĐÚNG.** Vùng đọc *tích luỹ* bản lưu. Chạy suite lần hai: T-3 đỏ ở dòng "Chưa đọc nguồn nào" (lần trước đã đọc rồi), test Ohara đỏ vì strict mode khớp hai thẻ bản lưu. Cả hai đều là **sản phẩm cư xử đúng**.

Đây là loại flake tệ nhất, và tệ ở chỗ nó **dụ người ta nới khẳng định thay vì sửa trạng thái**. Lần đầu tôi đã đi đúng vào bẫy: sửa locator cho chính xác hơn, tách công ty riêng cho từng test. Chỉ tới lần thứ hai mới thấy gốc là trạng thái, và sửa gốc bằng `e2e/global-setup.ts` seed lại trước cả suite — đúng thứ I-14 hứa với giám khảo, dùng cho đúng lý do đó: **kịch bản không diễn lại được từ trạng thái biết trước là kịch bản không kiểm được**. Đã kiểm tất định 3 lần chạy liên tiếp.

### Điều rút ra, áp được cho P3–P8

1. **Danh sách ADR chi phối phải suy ra từ những gì phase CHẠM, không từ trí nhớ.** Đây là lần thứ hai trong hai phiên: entry trước là ADR-0010 không tự suy từ `UPDATE` sang `INSERT`; lần này là ADR-0007 và ADR-0009 không có trong phase file dù nhóm 2 chạm cả hai. Hai lần thì là **mẫu**, không phải trùng hợp. Trước mỗi phase: liệt kê mọi đường ghi mới và mọi đường *sinh mới*, rồi đối chiếu ngược với 17 ADR.
2. **"Nút tắt AI" phải kiểm ở mọi đường sinh, không chỉ vòng quét.** P5/P6/P7 đều thêm đường sinh mới. Mỗi cái phải có một khẳng định T-9 riêng.
3. **Test đỏ vì hành vi đúng thì sửa trạng thái, đừng sửa khẳng định.** Nếu phải nới một khẳng định để test xanh, dừng lại và hỏi lại xem trạng thái đầu vào có xác định không.

---

## Quyết định

| Quyết định | Vì sao | Ghi ở đâu |
| --- | --- | --- |
| I-3 kiểm **trước** khi gọi extractor | Nửa đắt tiền của I-3 là lần gọi LLM. Test đếm số lần gọi, không chỉ đếm số bản lưu — chỉ đếm bản lưu thì một phiên bản vẫn gọi LLM mỗi 60s sẽ xanh | ADR-0017 |
| I-3 **không** áp cho nhánh nguồn lỗi | I-3 chống spam timeline và chi phí LLM; lần đọc lỗi không gây cả hai. Coi lần lỗi thứ hai là "đã đọc, không đổi" sẽ che một sự cố đang diễn ra | comment trong `observation-service.ts` |
| Bản lưu **vẫn** được ghi khi mọi phát hiện bị bỏ | Đã đọc nguồn là một sự thật. Chỉ phát hiện bị bỏ | khẳng định 2 |
| Tab *Bản gốc* hiện HTML dạng văn bản, **không render** | Render lại bản chụp là chạy markup trang khác trong origin của mình, mà mục đích của tab là để soi chính cái markup đó | `source-viewer.tsx` |
| Ba mức chắc chắn có **ký hiệu chấm** cạnh chữ | Phải phân biệt được trên ảnh đen trắng — màu không được là thứ duy nhất mang nghĩa | `quote-block.tsx` |
| Phát hiện nằm **dưới** bản lưu, không phải danh sách phẳng | Phát hiện không nguồn không có chỗ để đặt → luật 1 ép bằng hình dạng dữ liệu, không bằng việc nhớ thêm cái link | `reading-zone.tsx` |

Phép đo đột biến: nới dòng kiểm chuỗi con thành `?? { quoteStart: 0, quoteEnd: length }` — đúng kiểu người ta sẽ **nới** thay vì **bỏ** — → khẳng định 1 đỏ (`expected 1 to be +0`). Khôi phục, 15/15 xanh.

---

## Việc tiếp theo

| Việc | Khi |
| --- | --- |
| **Push branch** — 11 commit đang xếp chồng, 403 vì `gh` đăng nhập bằng `viethung2209` mà repo là `hungLV-hblab` | càng sớm càng tốt; P3–P7 không phụ thuộc nhưng không ai pull được |
| **Phép đo LLM thật của ADR-0014** — cần API key. Ba con số đã có sẵn trong `IngestResultDto`, không phải dựng thêm gì | **trước khi P5/P6 bắt đầu**, đúng bảng rủi ro của plan |
| P3 nhóm 1 (CRM làm tay) · P4 seed · rồi P5/P6/P7 | 13/08 hết ngày theo mốc plan |

## Còn treo

- **Nợ verify ADR-0014 còn 1/3.** Nói thẳng chỗ fixture không thay được: nó **không** trả lời được câu duy nhất phép đo đó tồn tại để trả lời — *LLM thật trả nguyên văn bao nhiêu phần trăm số lần*. Rủi ro paraphrase làm P5/P6 thiếu nguyên liệu **vẫn nguyên**, chỉ bị đẩy sang muộn hơn. Fixture 100% xanh không làm nó nhỏ đi. Nếu tới P5/P6 vẫn không có key thì đó là quyết định phải ghi ADR, không phải im lặng bỏ qua.
- **Chỉ số phát hiện bị bỏ chưa persist.** Trả về trong response, hiện trên giao diện, ghi log — nhưng không lưu. `WatchCycleRun` không có cột. P7/P8 phải quyết: thêm cột hay tính từ `claims`. **Không tự thêm cột** vì sẽ phá danh sách GRANT theo cột của ADR-0015.
- **`ontology-enum-parity.test.ts` vẫn không phủ hết** (từ entry trước, chưa sửa, chỉ có comment).
- **Q-6 (Admin thao tác CRM)** vẫn treo, vẫn chặn ma trận quyền nhóm 6.
- **Telemetry thành viên 2 và 3** vẫn chưa verify trên Grafana — điều kiện qua vòng 1.
