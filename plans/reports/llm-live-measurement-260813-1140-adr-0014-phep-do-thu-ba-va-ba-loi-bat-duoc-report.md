# Phép đo LLM thật — trả nốt nợ verify ADR-0014, và ba lỗi nó bắt được

**Ngày:** 2026-08-13 11:20–11:45 · **Nhánh:** `feat/phase-2` · **Model:** `claude-haiku-4-5-20251001`

## Kết quả một dòng

Nợ verify cuối của ADR-0014 đã trả: **11 draft, 0 bị bỏ vì câu trích không nguyên văn.** Cửa chặn P5/P6 mở. Trên đường đi, phép đo bắt được **3 lỗi** mà 113 test xanh trên fixture không thể bắt, cộng **1 lỗi hạ tầng test** làm cả bộ test không khởi động được.

## Ba con số

| Chỉ số | Vòng 1 (prompt cũ) | Vòng 2 (prompt đã sửa) | Cộng |
| --- | --- | --- | --- |
| Draft LLM đề xuất | 5 | 6 | **11** |
| Bỏ vì câu trích không nguyên văn | 0 | 0 | **0 (0%)** |
| Hạ khỏi mức Chắc | 2 | 5 | 7 |
| Lưu được | 5 | 6 | 11 |

8 lượt đọc = 4 công ty × 2 bản chụp; 2 lượt là nguồn lỗi (`fetch_status=failed`, đúng thiết kế, 0 claim).

**Đối chiếu độc lập** bằng SQL thẳng trên CSDL, không qua service đã lưu: 6/6 câu trích là chuỗi con thật của `raw_content`, **và** 6/6 offset cắt lại ra đúng chuỗi đó — Sales bấm vào sẽ highlight đúng đoạn, không lệch.

**I-3 giữ trên đường thật:** đọc lại nội dung y nguyên → `unchanged:true`, 0 bản lưu mới, 0 lượt gọi LLM.

## Bốn lỗi bắt được

| # | Lỗi | Trạng thái |
| --- | --- | --- |
| 1 | `docker-compose.yml` **không truyền `ANTHROPIC_API_KEY`** vào `api`/`worker`. `.env` có key mà log vẫn báo "trống → dùng Fixture". Đúng kịch bản mà comment trong `claim-extractor.provider.ts` đã cảnh báo bằng chữ — cảnh báo ở tầng ứng dụng không bịt được lỗ ở tầng compose | ✅ Sửa: anchor `x-llm-access`, dùng `:-` chứ không `:?` để bộ nghiệm thu vẫn chạy khi giám khảo không có key |
| 2 | LLM trả `statement` **bằng tiếng Anh** cho nguồn tiếng Việt. Prompt chưa bao giờ *nói* ra luật ngôn ngữ, chỉ ngầm định | ✅ Sửa prompt. Vòng 2: 6/6 statement tiếng Việt |
| 3 | **Cửa kiểm mức Chắc hạ 5/6 claim, cả 5 chỉ vì tên công ty viết đủ** (`Cloud, Solutions` không có trong câu trích). Không lần nào model bịa số hay bịa tên bên thứ ba. Ba mức tin cậy Specs đòi thực tế còn hai | ⏸ **Chưa sửa — chờ quyết định**, [ADR-0018](../../docs/decisions/0018-cua-kiem-muc-chac-bo-qua-ten-cua-chinh-cong-ty-dang-doc.md) |
| 4 | **`pnpm test:unit` không khởi động được** trên Node 22.11: Vite 7 ESM-only, config nạp theo đường CJS → `ERR_REQUIRE_ESM`. Không phải test đỏ — là **cả bộ test không chạy** | ✅ 4 file config → `.mts`. 113/113 xanh trên đúng Node đó |

## Kiểm lại sau khi sửa

`pnpm test:unit` **113/113** · `pnpm test:e2e` **6/6** (chạy trên stack đang cắm **LLM thật**, T-3 vẫn xanh) · `pnpm typecheck` sạch · `pnpm lint` sạch.

## Cần người quyết định

1. **ADR-0018** — cửa kiểm mức Chắc có bỏ qua tên của chính công ty đang đọc không? Đề xuất: có, vẫn kiểm số và tên bên thứ ba. Chưa sửa vì `claim-service.ts` thuộc chủ quyền A và đây là hành vi do ADR-0007 chốt.
2. **Merge `feat/phase-2` → `master`** — vẫn treo từ đầu phiên. `master` thua 13 commit; P3 và P4 đều `dependencies: [1]` nên người làm hai phase đó đang không có schema để nhánh ra.
3. **Model dùng cho demo** — `.env` đang đặt `claude-haiku-4-5`, ADR-0014 ghi mặc định `claude-sonnet-5`. Số đo ở trên là của haiku. Nếu ngày thi chạy sonnet thì đo lại (miễn phí, chỉ số có sẵn trong response).

## Câu hỏi chưa giải quyết

- 11 draft là mẫu nhỏ, một ngôn ngữ, trang ngắn. Đủ mở cửa P5/P6, **không** đủ để nói "LLM luôn trích nguyên văn". Bản chụp của P4 dài hơn thì nên đo lại một lượt.
- Claim vòng 1 gắn `signal_type = expansion` cho câu "ba dây chuyền lắp ráp" — sự việc cũ, không phải tín hiệu mở rộng. Cửa kiểm chuỗi con **không bắt được nhãn sai**, chỉ bắt câu trích sai. Chưa có cửa nào cho `signal_type`; P5 (hàng đợi) sẽ là nơi nhãn sai gây hại đầu tiên.
