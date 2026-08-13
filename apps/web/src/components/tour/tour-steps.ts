export interface TourStep {
  /** `data-tour` value of the element to point at. Undefined → a centred step with no anchor. */
  anchor?: string
  title: string
  description: string
}

/**
 * Six steps, one per thing a judge has to understand about this product, in the order the
 * autonomy ceiling is declared in CLAUDE.md section 4.
 *
 * These sentences ARE the round-two answer. They are written to be correct, not to be
 * welcoming — a tour that says something the ontology does not is worse than no tour, because
 * it teaches a wrong answer with the product's own voice.
 *
 * Every anchor is a `data-tour` attribute, never a class or a DOM shape. Restyling changes
 * classes; a tour pinned to a class starts pointing at the wrong element in silence, and
 * driver.js skips a step whose anchor is missing WITHOUT saying so.
 */
export const TOUR_STEPS: TourStep[] = [
  {
    anchor: 'sidebar',
    title: 'Sáu màn, một đường đi',
    description:
      'Công ty và Cơ hội là CRM làm tay. Hàng đợi là chỗ duyệt gợi ý của máy. Tổng quan trả lời "sáng nay làm gì". Thông báo ghi việc hệ thống đã tự làm. Hướng dẫn là trang này, dạng đầy đủ.',
  },
  {
    anchor: 'queue',
    title: 'Vùng 2 — máy đề xuất, người quyết',
    description:
      'Số trên mục Hàng đợi là số gợi ý đang chờ. Không duyệt thì không có gì xảy ra, vô thời hạn: gợi ý không tự hết hạn thành hành động.',
  },
  {
    anchor: 'proposal-card',
    title: 'Bằng chứng đứng cạnh nút bấm',
    description:
      'Mỗi gợi ý mang câu trích nguyên văn của nguồn ngay trong thẻ. Duyệt và Bỏ nằm cạnh bằng chứng chứ không đứng một mình — người duyệt không phải nhớ mình đang duyệt cái gì.',
  },
  {
    anchor: 'next-step-cell',
    title: 'Vùng 3 — máy tự ghi, nhưng hoàn tác được',
    description:
      'Việc tiếp theo do máy điền mang viền tím và nhãn "do hệ thống điền". Hoàn tác là một cú bấm, còn hiệu lực 7 ngày, và máy không bao giờ đè lên ô do người gõ.',
  },
  {
    anchor: 'quote-block',
    title: 'Không có nguồn thì không hiển thị',
    description:
      'Mọi nhận định của AI bấm ra được đúng đoạn văn sinh ra nó. Phát hiện nào không khớp câu trích nguyên văn thì hệ thống không lưu — code đối chiếu chuỗi, không tin lời của mô hình.',
  },
  {
    anchor: 'ai-status',
    title: 'Vùng 4 và công tắc tắt sạch',
    description:
      'Vòng quét tự thêm mục dòng thời gian cho công ty đang theo dõi, luôn kèm nhãn "do hệ thống thêm" và câu trích, và Sales xoá được. Có một công tắc tắt sạch cả bốn vùng, hiệu lực ngay, dữ liệu đã sinh không bị xoá.',
  },
]
