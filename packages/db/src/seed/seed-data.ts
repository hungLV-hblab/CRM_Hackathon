/**
 * SEED DATA — not real data, and not a per-test fixture. This is the dataset the judges
 * replay the demo scenario against (I-14).
 *
 * Every `id` and every `passwordHash` is a hard-coded constant, on purpose. Generate them at
 * run time and a second seed produces a different state than the first — exactly what I-14
 * forbids, and the judges replaying the scenario would see the data drift.
 *
 * The demo passwords `sales123` / `admin123` are published in the README so judges can log
 * in. A bcrypt hash of an already-published password is not a secret.
 */

export const DEMO_PASSWORDS = {
  sales: 'sales123',
  admin: 'admin123',
} as const

export const SEED_USERS = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'sales@hblab.vn',
    name: 'Sales ITO',
    role: 'sales' as const,
    passwordHash: '$2a$10$0PdFm08li2/lN/wIJ7jBoevYWmURrzqRZqrxoTtWO21Mk.dqTpB3i',
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    email: 'admin@hblab.vn',
    name: 'Quản trị',
    role: 'admin' as const,
    passwordHash: '$2a$10$rWBpvu8RmgoSaH9icjyqA.b4ADRQx9SeDKrN39eEC8uCECu7PkuJq',
  },
]

const SALES_ID = SEED_USERS[0].id

export const SEED_COMPANIES = [
  {
    id: 'aaaaaaaa-0001-4000-8000-000000000001',
    name: 'Sakura Manufacturing KK',
    industry: 'Sản xuất linh kiện',
    companyType: 'traditional' as const,
    country: 'Nhật Bản',
    size: '500-1000',
    website: 'https://sakura-mfg.example.jp',
    isWatched: true,
    ownerId: SALES_ID,
  },
  {
    id: 'aaaaaaaa-0002-4000-8000-000000000002',
    name: 'Nimbus Cloud Solutions',
    industry: 'Tích hợp hệ thống',
    companyType: 'it_solution' as const,
    country: 'Singapore',
    size: '100-500',
    website: 'https://nimbus.example.sg',
    isWatched: true,
    ownerId: SALES_ID,
  },
  {
    id: 'aaaaaaaa-0003-4000-8000-000000000003',
    name: 'Kitefin Analytics',
    industry: 'Phân tích dữ liệu',
    companyType: 'tech_startup' as const,
    country: 'Hoa Kỳ',
    size: '50-100',
    /**
     * Deliberately EMPTY while the Kitefin page states a website (ADR-0024). This is the demo's
     * "fill a blank cell" proposal, and it sits on a WATCHED company on purpose: together with
     * Sakura's stale `size` it means both halves of Specs group 3 ("điền hoặc sửa một ô còn
     * trống hoặc đã cũ") are demonstrated inside the watch set, so neither depends on Marlin —
     * the company the plan lists as first to cut.
     */
    website: null,
    /**
     * Watched, so the demo has THREE watched companies with a readable source — the exact
     * count acceptance check 8 counts. Ohara stays unwatched: it is the unreadable source,
     * and inside the watch set it would blur the "two flipped → two new entries" arithmetic.
     */
    isWatched: true,
    ownerId: SALES_ID,
  },
  {
    id: 'aaaaaaaa-0004-4000-8000-000000000004',
    name: 'Ohara Retail Group',
    industry: 'Bán lẻ',
    companyType: 'other_ito' as const,
    country: 'Nhật Bản',
    size: '1000+',
    website: null,
    isWatched: false,
    ownerId: SALES_ID,
  },
  /**
   * The company-type lens made visible: Marlin's `after` snapshot carries the SAME funding
   * paragraph as Sakura's, and the two are `it_product` and `traditional`. Whatever feature
   * group 2 reads out of the two pages differs by the lens or by nothing.
   */
  {
    id: 'aaaaaaaa-0005-4000-8000-000000000005',
    name: 'Marlin Product Labs',
    industry: 'Phần mềm đóng gói',
    companyType: 'it_product' as const,
    country: 'Singapore',
    size: '50-100',
    website: 'https://marlin-labs.example.com',
    isWatched: false,
    ownerId: SALES_ID,
  },
]

/**
 * Two contacts on ONE company, exactly one of them the đầu mối chính.
 *
 * The second one is not padding: promoting it is what demonstrates that the previous PIC is
 * demoted in the same request, and with a single contact the partial unique index on
 * `(company_id) WHERE is_primary` is never actually exercised by the demo.
 */
export const SEED_CONTACTS = [
  {
    id: 'dddddddd-0001-4000-8000-000000000001',
    companyId: SEED_COMPANIES[0].id,
    name: 'Takahashi Kenji',
    title: 'Trưởng phòng sản xuất',
    email: 'takahashi@sakura-mfg.example.jp',
    isPrimary: true,
  },
  {
    id: 'dddddddd-0002-4000-8000-000000000002',
    companyId: SEED_COMPANIES[0].id,
    name: 'Ishida Mari',
    title: 'Điều phối mua hàng',
    email: 'ishida@sakura-mfg.example.jp',
    isPrimary: false,
  },
  {
    id: 'dddddddd-0003-4000-8000-000000000003',
    companyId: SEED_COMPANIES[1].id,
    // NOT the CTO named in Nimbus' `after` snapshot: that appointment is news the demo has
    // not read yet, and seeding the person in advance would make the news look already known.
    name: 'Lim Boon Hock',
    title: 'Giám đốc Kinh doanh',
    email: 'boonhock@nimbus.example.sg',
    isPrimary: true,
  },
]

/**
 * At least one OPEN opportunity is mandatory: I-6 only allows auto-setting a next step when
 * the company has ≥1 open opportunity, so with none open feature group 4 has nothing to demo.
 * The first row carries `nextStepSource: 'human'` so group 4 inherits a ready-made I-7 case
 * (the system must not overwrite it).
 */
export const SEED_OPPORTUNITIES = [
  {
    id: 'bbbbbbbb-0001-4000-8000-000000000001',
    companyId: SEED_COMPANIES[0].id,
    name: 'Thuê ngoài đội bảo trì MES',
    expectedValue: '240000.00',
    expectedCloseMonth: '2026-11',
    stage: 'qualified' as const,
    nextStepText: 'Gửi lại báo giá sau buổi họp kỹ thuật',
    nextStepDueDate: '2026-08-20',
    nextStepSource: 'human' as const,
    /**
     * All FOUR cells filled, so this is the one deal past the qualification gate that carries
     * NO warning flag. Without it every card on the board wears the same flag and the screen
     * shows a single state — which reads as "the flag is always on" rather than as a rule.
     */
    needSignal: 'Đội bảo trì MES nội bộ thiếu 6 kỹ sư, đang phải chạy ca đêm.',
    needSignalSource: 'Họp kỹ thuật 05/08/2026 với trưởng phòng sản xuất',
    budgetSignal: 'Đã duyệt ngân sách thuê ngoài cho năm tài chính 2026.',
    budgetSignalSource: 'Email phòng mua hàng ngày 07/08/2026',
  },
  {
    id: 'bbbbbbbb-0002-4000-8000-000000000002',
    companyId: SEED_COMPANIES[1].id,
    name: 'Đội phát triển nền tảng tích hợp',
    expectedValue: '480000.00',
    expectedCloseMonth: '2026-10',
    stage: 'negotiation' as const,
    nextStepText: null,
    nextStepDueDate: null,
    nextStepSource: null,
  },
  {
    id: 'bbbbbbbb-0003-4000-8000-000000000003',
    companyId: SEED_COMPANIES[2].id,
    name: 'Mở rộng đội dữ liệu',
    expectedValue: '120000.00',
    expectedCloseMonth: '2026-12',
    stage: 'prospecting' as const,
    nextStepText: null,
    nextStepDueDate: null,
    nextStepSource: null,
  },
  /**
   * Two lost deals, one WITH a reason and one without, because the overview splits them: the
   * reasons go in the table, the deal with no reason stands on its own line outside it. Seed
   * only the first kind and that separation never appears on screen.
   */
  {
    id: 'bbbbbbbb-0004-4000-8000-000000000004',
    companyId: SEED_COMPANIES[3].id,
    name: 'Thuê ngoài đội vận hành cửa hàng',
    expectedValue: '90000.00',
    expectedCloseMonth: '2026-07',
    stage: 'lost' as const,
    nextStepText: null,
    nextStepDueDate: null,
    nextStepSource: null,
    lostReason: 'Khách chọn đối tác đã có đội tại chỗ',
  },
  {
    id: 'bbbbbbbb-0005-4000-8000-000000000005',
    companyId: SEED_COMPANIES[4].id,
    name: 'Đội kiểm thử cho bản phát hành mùa thu',
    expectedValue: '60000.00',
    expectedCloseMonth: '2026-06',
    stage: 'lost' as const,
    nextStepText: null,
    nextStepDueDate: null,
    nextStepSource: null,
    lostReason: null,
  },
]

export const SEED_TIMELINE_ENTRIES = [
  {
    id: 'cccccccc-0001-4000-8000-000000000001',
    companyId: SEED_COMPANIES[0].id,
    entryType: 'activity' as const,
    occurredAt: new Date('2026-08-05T02:00:00Z'),
    description: 'Họp kỹ thuật với trưởng phòng sản xuất, thống nhất phạm vi bảo trì.',
    createdBy: 'human' as const,
  },
  {
    id: 'cccccccc-0002-4000-8000-000000000002',
    companyId: SEED_COMPANIES[1].id,
    entryType: 'stage_change' as const,
    occurredAt: new Date('2026-08-08T07:30:00Z'),
    description: 'Chuyển giai đoạn: Soạn đề xuất → Thương lượng.',
    createdBy: 'human' as const,
  },
]
