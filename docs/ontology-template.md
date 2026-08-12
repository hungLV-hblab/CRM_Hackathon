# Ontology — <tên module> *(TEMPLATE)*

> Copy thành `docs/ontology.md` ngay 12/08 khi có Specs — AI sinh nháp, **người review và duyệt**. Đây là việc đầu tiên sau khi đọc đề.
> Nền lý thuyết: [ai-native-design-principles.md](./ai-native-design-principles.md).
>
> **Test nghiệm thu:** mọi quan hệ phải đọc lên thành một câu tiếng Việt có nghĩa. Không gọi tên được quan hệ = chưa hiểu domain.

## 1. Domain này là gì

Một đoạn: module làm gì, phục vụ ai, ranh giới ở đâu (cái gì **không** thuộc module này).

## 2. Đối tượng cố định — không sửa

Bốn đối tượng nguyên thuỷ, dùng cho mọi module:

| Đối tượng | Thuộc tính tối thiểu |
| --- | --- |
| `Observation` | `id`, `source_url`, `source_tier` (1–6 theo tháp độ tin cậy), `captured_at`, `raw_content` |
| `Claim` | `id`, `statement`, `confidence` (chắc chắn / phỏng đoán), `derived_from[]` → Observation |
| `Proposal` | `id`, `action`, `supported_by[]` → Claim, `status` (chờ/accepted/rejected/edited), `decided_by`, `decided_at` |
| `Provenance` | Không phải bảng riêng — là ràng buộc: mọi Claim/Proposal **phải** trỏ ngược về Observation gốc, kèm vị trí đoạn trích |

## 3. Đối tượng domain — điền theo Specs

| Đối tượng | Thuộc tính | Là gốc hay dẫn xuất |
| --- | --- | --- |
| `Company` | name, domain, market, size | gốc |
| `Contact` | name, title, email | dẫn xuất từ Company |
| ... | | |

## 4. Quan hệ có tên — phần quan trọng nhất

| Chủ thể | Quan hệ | Đối tượng | Đọc thành câu |
| --- | --- | --- | --- |
| `Contact` | `works_for` | `Company` | "Nguyễn Văn A **làm việc cho** công ty X" |
| `Deal` | `pursued_at` | `Company` | "Deal Y **đang được theo đuổi tại** công ty X" |
| `Claim` | `derived_from` | `Observation` | "Nhận định này **rút ra từ** bản crawl ngày 10/08" |
| `Proposal` | `supported_by` | `Claim` | "Đề xuất này **được chống đỡ bởi** nhận định Z" |
| ... | | | |

Quy tắc: quan hệ **nóng, truy vấn thường xuyên** thì để thành khoá ngoại thật; quan hệ do **AI suy ra** thì lưu ở bảng quan hệ chung kèm `source_claim_id`.

## 5. Trần tự chủ của AI

> Viết bằng ngôn ngữ tự nhiên ở đây, nhưng **phải có test chứng minh vùng cấm bị chặn thật**. Ghi mà không enforce = mất đúng điểm governance.

| Vùng | Hành động |
| --- | --- |
| **Tự do** | Tạo Observation: crawl web, ingest note, đọc nguồn |
| **Chờ duyệt** | Sinh Claim, chấm điểm, xếp ưu tiên, sinh Proposal |
| **Cấm tuyệt đối** | Tự gửi email/tin nhắn cho khách hàng, trong mọi tình huống · Sửa dữ liệu chính thức · Xoá bất cứ thứ gì. AI chỉ được **báo "số liệu này sai"**, người sửa |

## 6. Chuỗi dẫn xuất tài liệu

Tài liệu nào là input của tài liệu nào, phép biến đổi giữa chúng là gì:

```
Specs BTC → phản biện persona (ai-sessions) → user stories + AC → ontology.md → schema + types → code
                                            ↘ ADR (lý do + phương án loại)
```

## 7. Chỉ số đo từ ngày đầu

| Chỉ số | Đo ở đâu |
| --- | --- |
| **Auto-accept rate** | Tỉ lệ Proposal `accepted` không qua sửa — đo hệ thống khôn lên |
| **Error-detection rate** | Tỉ lệ Proposal bị `rejected`/`edited` kèm lý do — đo người khôn lên |

## 8. Checklist duyệt ontology

- [ ] Mọi quan hệ đọc thành câu có nghĩa
- [ ] Mọi dữ liệu AI tạo ra đã phân loại đúng Observation / Claim / Proposal
- [ ] Mọi Claim có đường về Observation gốc
- [ ] Vùng cấm đã liệt kê tường minh và có test chặn
- [ ] Có chỗ ghi nhận accept/reject/edit trên từng Proposal
- [ ] Người (không phải AI) đã đọc và duyệt file này
