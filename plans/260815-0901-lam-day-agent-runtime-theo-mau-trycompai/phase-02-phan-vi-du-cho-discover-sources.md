# Phase 02 — Phản ví dụ cho `discover-sources`

## Bối cảnh

`agent/skills/identity-matching.md` của repo nguồn có một mục tên **"Things that look like evidence and are not"**, liệt kê từng thứ trông như căn cứ mà không phải, kèm ví dụ hỏng có thật (một truy vấn tên riêng trả về CEO của công ty khác, *"all with total confidence"*).

`extract-claims` của ta đã có cặp ĐÚNG/SAI. `discover-sources` **không có mục nào** — trong khi nó là skill mới nhất, và là skill duy nhất được cấp tool, tức là skill duy nhất có thể bịa ra một URL trông hợp lý.

`verify-candidates-reachable.ts` đã bắt được URL không mở được. Nó **không** bắt được URL mở được mà nói về công ty trùng tên — đúng chỗ phản ví dụ phải gánh.

## Yêu cầu

- Thuần văn bản trong `SKILL.md`. Không đụng code, không đụng test hiện có.
- Phản ví dụ phải là **thứ đã thật sự hỏng hoặc chắc chắn sẽ hỏng**, không phải lời khuyên chung. Mỗi dòng nói rõ *vì sao nó trông đúng*.
- Không mâu thuẫn với luật đã có trong file (tối đa 6 ứng viên, rỗng là hợp lệ).

## File

| File | Việc |
| --- | --- |
| `apps/agent-runtime/skills/discover-sources/SKILL.md` | Sửa — thêm mục phản ví dụ |

## Kiểm chứng

Test `skill discover-sources đi kèm sản phẩm` vẫn xanh (nó khẳng định `TỰ MỞ` và các enum `SOURCE_TIER` còn nguyên trong prompt).
