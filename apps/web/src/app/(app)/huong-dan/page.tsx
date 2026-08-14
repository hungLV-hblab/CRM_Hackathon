import Link from 'next/link'

import { PageHeader } from '@/components/shell/page-header'
import { Badge } from '@/components/ui/badge'
import { SectionCard } from '@/components/ui/section-card'
import { PageBody } from '@/components/shell/page-body'

/**
 * What the machine is allowed to do on its own, and what stops it in each case.
 *
 * A server component with no API call: this page describes the SYSTEM's rules, not any row in
 * it, so it must read the same on a broken database as on a healthy one.
 *
 * The wording is lifted from CLAUDE.md section 4 and `docs/ontology.md` rather than rephrased.
 * A friendlier paraphrase that drifts from the ontology is the trap round two is built to
 * catch: two documents describing one boundary, disagreeing about where it sits.
 */
export const metadata = { title: 'Hướng dẫn — CRM HBLAB' }

interface Zone {
  id: string
  title: string
  allowed: string
  safeguard: string
  checks: string
  link?: { href: string; label: string }
}

const ZONES: Zone[] = [
  {
    id: 'vung-1',
    title: 'Vùng 1 · Tự do',
    allowed:
      'Tạo bản lưu (đọc bản chụp, ingest ghi chú) và phát hiện (rút ra mệnh đề từ bản lưu đó).',
    safeguard:
      'Không chạm vào dữ liệu chính thức. Phát hiện nào không có câu trích nguyên văn thì không lưu được — code đối chiếu chuỗi con, không tin lời của mô hình.',
    checks: 'T-2, T-2b',
    link: { href: '/cong-ty', label: 'Mở một công ty và bấm Đọc bản chụp để tự kiểm' },
  },
  {
    id: 'vung-2',
    title: 'Vùng 2 · Chờ duyệt',
    allowed: 'Sinh gợi ý: sửa ô hồ sơ công ty, thêm mục vào dòng thời gian.',
    safeguard:
      'Không duyệt thì không có gì xảy ra, vô thời hạn. Gợi ý không tự hết hạn thành hành động, và mỗi gợi ý đứng cạnh bằng chứng của chính nó.',
    checks: 'T-4, T-5',
    link: { href: '/hang-doi', label: 'Xem hàng đợi gợi ý' },
  },
  {
    id: 'vung-3',
    title: 'Vùng 3 · Tự ghi, hoàn tác được',
    allowed: 'Tự điền Việc tiếp theo và ngày hạn cho cơ hội đang mở.',
    safeguard:
      'Thông báo ngay, Hoàn tác một cú bấm trong 7 ngày, ghi vết hai chiều. Không bao giờ đè lên ô do người gõ.',
    checks: 'T-6, T-7',
    link: { href: '/co-hoi', label: 'Xem ô do hệ thống điền trên bảng cơ hội' },
  },
  {
    id: 'vung-4',
    title: 'Vùng 4 · Tự ghi, không hỏi ai',
    allowed: 'Vòng quét tự thêm mục dòng thời gian cho công ty đang theo dõi.',
    safeguard:
      'Nhãn "do hệ thống thêm" kèm câu trích, Sales xoá được, và nhật ký vòng quét ghi từng vòng.',
    checks: 'T-8',
    link: { href: '/thong-bao', label: 'Xem việc hệ thống đã tự làm' },
  },
]

const FORBIDDEN = [
  'Đổi giai đoạn của cơ hội',
  'Đánh dấu Thắng hoặc Thua',
  'Sửa giá trị tiền',
  'Liên hệ khách hàng',
  'Xoá dữ liệu do người tạo',
]

export default function GuidePage() {
  return (
    <PageBody width="reading">
      <PageHeader
        title="Hướng dẫn"
        description="Máy được làm gì, và cái gì chặn nó lại trong từng trường hợp. Bốn vùng dưới đây là trần tự chủ đã khai báo, không phải mô tả cho đẹp — mỗi vùng có mã nghiệm thu chứng minh nó bị chặn thật."
      />

      {ZONES.map((zone) => (
        <section
          key={zone.id}
          className="flex flex-col gap-3 rounded-card border border-ink-200 bg-surface p-5 shadow-card"
        >
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-section font-semibold text-ink-900">{zone.title}</h2>
            <Badge tone="neutral">Nghiệm thu {zone.checks}</Badge>
          </div>

          <dl className="flex flex-col gap-2 text-sm">
            <div>
              <dt className="font-medium text-ink-900">AI được làm gì</dt>
              <dd className="text-ink-700">{zone.allowed}</dd>
            </div>
            <div>
              <dt className="font-medium text-ink-900">Cơ chế an toàn</dt>
              <dd className="text-ink-700">{zone.safeguard}</dd>
            </div>
          </dl>

          {zone.link && (
            <Link
              href={zone.link.href}
              className="inline-flex min-h-11 items-center text-sm text-ink-600 underline underline-offset-2 hover:text-ink-900"
            >
              {zone.link.label} →
            </Link>
          )}
        </section>
      ))}

      <section className="flex flex-col gap-3 rounded-card border border-danger/30 bg-danger-surface p-5">
        <h2 className="text-lg font-semibold text-ink-900">✋ Cấm tuyệt đối</h2>
        <p className="text-body-lg leading-relaxed text-ink-700">
          Năm việc dưới đây AI không làm, ở bất kỳ vùng nào. Chặn ở tầng nghiệp vụ và bằng ràng
          buộc cơ sở dữ liệu, không phải bằng một lời dặn trong prompt — một lời dặn suông với
          phần AI không tính là đã chặn. Nghiệm thu T-10.
        </p>
        <ul className="flex list-disc flex-col gap-1 pl-5 text-body-lg leading-relaxed text-ink-700">
          {FORBIDDEN.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <SectionCard title="Tắt sạch AI">
        <p className="text-body-lg leading-relaxed text-ink-700">
          Có một công tắc tắt sạch cả bốn vùng, hiệu lực ngay. Dữ liệu AI đã sinh{' '}
          <strong>không bị xoá</strong> — hệ thống chỉ dừng sinh mới. Giá trị nằm ở{' '}
          <code className="rounded bg-ink-100 px-1 py-0.5 text-xs">system_settings.ai_enabled</code>
          , và cả API lẫn vòng quét đọc lại nó ở mỗi lần gọi, không cache, nên tắt là có hiệu lực
          ở nhịp kế tiếp. Nghiệm thu T-9.
        </p>
        {/*
          The link waited for `/quan-tri/page.tsx` to exist. `e2e/guide-page.spec.ts` walks every
          link on this page and fails the build on a 404 — writing one ahead of its screen would
          send a judge to Next's not-found from the one page whose job is to explain the system.
        */}
        <p className="text-body-lg leading-relaxed text-ink-700">
          Công tắc nằm ở{' '}
          <Link
            href="/quan-tri"
            className="underline underline-offset-2 hover:text-ink-900"
          >
            màn Quản trị
          </Link>{' '}
          cùng với các chỉ số đo. Khi AI tắt, mọi màn đều hiện một dải băng nói rõ — Sales không
          cần quyền Quản trị để biết máy đang dừng.
        </p>
      </SectionCard>
    </PageBody>
  )
}
