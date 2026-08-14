'use client'

import { Search } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { useMemo, useState, type FormEvent } from 'react'

import { COMPANY_TYPE, type CreateCompanyDto, type ListCompaniesQuery } from '@crm/contracts'

import { toast } from 'sonner'

import { PageHeader } from '@/components/shell/page-header'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  PendingProposalMarker,
  usePendingProposalCounts,
} from '@/components/proposal/pending-proposal-marker'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { FilterBar, type FilterChip } from '@/components/ui/filter-bar'
import { Input, Select } from '@/components/ui/input'
import { Cell, Table, type TableSort } from '@/components/ui/table'
import { ErrorState } from '@/components/ui/error-state'
import { EmptyState } from '@/components/ui/empty-state'
import { PageBody } from '@/components/shell/page-body'
import { api, ApiError } from '@/lib/api-client'

const EMPTY_FORM: CreateCompanyDto = { name: '', industry: '', companyType: 'traditional' }
const EMPTY_FILTERS: ListCompaniesQuery = {}

export default function CompanyListPage() {
  const queryClient = useQueryClient()
  const [isDialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<CreateCompanyDto>(EMPTY_FORM)
  const [filters, setFilters] = useState<ListCompaniesQuery>(EMPTY_FILTERS)

  /**
   * Filtering happens on the server, so the key carries the filters: two different filter
   * sets are two different results and must not share a cache entry.
   */
  const companies = useQuery({
    queryKey: ['companies', filters],
    queryFn: () => api.listCompanies(filters),
  })

  /**
   * The dropdown options come from what is actually stored, not from a hard-coded list:
   * industry and country are free text, so a fixed list would go stale the first time
   * somebody types a new one. Read from an unfiltered fetch so choosing one filter never
   * empties the other dropdown.
   */
  const allCompanies = useQuery({ queryKey: ['companies', {}], queryFn: () => api.listCompanies() })
  /** Specs group 3: the list must show which companies have something waiting for a decision. */
  const pendingProposals = usePendingProposalCounts()
  const industries = useMemo(
    () => unique((allCompanies.data ?? []).map((row) => row.industry)),
    [allCompanies.data],
  )
  const countries = useMemo(
    () => unique((allCompanies.data ?? []).map((row) => row.country).filter(Boolean) as string[]),
    [allCompanies.data],
  )

  /**
   * The screen owns the order, not the Table. A component that sorts its own rows becomes a
   * second source of truth about sequence, free to disagree with whatever the server sent —
   * so `Table` reports the click and this decides what it means.
   *
   * Vietnamese collation is explicit: the default comparison puts Đ after D-with-anything and
   * gets the vowels with diacritics wrong, which for a list of Vietnamese company names is
   * simply the wrong alphabet.
   */
  const [sort, setSort] = useState<TableSort | undefined>(undefined)

  function toggleSort(key: string) {
    setSort((current) =>
      current?.key === key
        ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'asc' },
    )
  }

  const sorted = useMemo(() => {
    const rows = companies.data ?? []
    if (!sort) return rows
    const factor = sort.direction === 'asc' ? 1 : -1
    return [...rows].sort(
      (a, b) =>
        factor *
        String(a[sort.key as 'name' | 'industry']).localeCompare(
          String(b[sort.key as 'name' | 'industry']),
          'vi',
        ),
    )
  }, [companies.data, sort])

  const createCompany = useMutation({
    mutationFn: api.createCompany,
    onSuccess: async () => {
      // Refetch rather than pushing the new row into the cache by hand: the server owns
      // fields the form never sent (`id`, `isWatched`), and inventing them locally is how a
      // list starts disagreeing with the database.
      await queryClient.invalidateQueries({ queryKey: ['companies'] })
      setDialogOpen(false)
      setForm(EMPTY_FORM)
      // Confirms what already happened. The row is in the table either way — this only saves
      // the reader from scanning for it.
      toast.success(`Đã thêm công ty ${form.name}`)
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : 'Không lưu được công ty')
    },
  })

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    createCompany.mutate(form)
  }

  return (
    <PageBody>
      {/* The three cross-screen links and the logout button that used to sit here are the
          shell's job now — the sidebar reaches every screen and the account menu holds the
          logout. Leaving a second "Đăng xuất" on the page would give the app two of them. */}
      <PageHeader
        title="Công ty"
        actions={<Button onClick={() => setDialogOpen(true)}>Thêm công ty</Button>}
      />

      <FilterBar chips={filterChips(filters, setFilters)} onReset={() => setFilters(EMPTY_FILTERS)}>
        <Input
          label="Tìm theo tên"
          value={filters.q ?? ''}
          onChange={(event) => setFilters({ ...filters, q: event.target.value || undefined })}
        />
        <Select
          label="Lọc theo ngành"
          value={filters.industry ?? ''}
          onChange={(event) =>
            setFilters({ ...filters, industry: event.target.value || undefined })
          }
        >
          <option value="">Tất cả</option>
          {industries.map((industry) => (
            <option key={industry} value={industry}>
              {industry}
            </option>
          ))}
        </Select>
        <Select
          label="Lọc theo loại hình"
          value={filters.companyType ?? ''}
          onChange={(event) =>
            setFilters({ ...filters, companyType: event.target.value || undefined })
          }
        >
          <option value="">Tất cả</option>
          {Object.entries(COMPANY_TYPE).map(([code, label]) => (
            <option key={code} value={code}>
              {label}
            </option>
          ))}
        </Select>
        <Select
          label="Lọc theo quốc gia"
          value={filters.country ?? ''}
          onChange={(event) => setFilters({ ...filters, country: event.target.value || undefined })}
        >
          <option value="">Tất cả</option>
          {countries.map((country) => (
            <option key={country} value={country}>
              {country}
            </option>
          ))}
        </Select>
        <Select
          label="Lọc theo theo dõi"
          value={filters.isWatched === undefined ? '' : String(filters.isWatched)}
          onChange={(event) =>
            setFilters({
              ...filters,
              isWatched: event.target.value === '' ? undefined : event.target.value === 'true',
            })
          }
        >
          <option value="">Tất cả</option>
          <option value="true">Đang theo dõi</option>
          <option value="false">Không theo dõi</option>
        </Select>
      </FilterBar>

      {companies.isPending && <Skeleton className="h-64 w-full rounded-card" />}

      {companies.isError && (
        <ErrorState error={companies.error} fallback={'Không tải được danh sách công ty'} />
      )}

      {/* No "Xoá bộ lọc" button here any more. The filter bar above carries one whenever a
          filter is on, and two buttons with the same name are ambiguous to a screen reader and
          to `getByRole` alike — the way out has to be in exactly one place. */}
      {companies.data?.length === 0 && (
        <EmptyState message="Không có công ty nào khớp bộ lọc đang chọn. Bỏ bớt điều kiện ở thanh lọc phía trên để xem lại danh sách." icon={Search} />
      )}

      {companies.data && companies.data.length > 0 && (
        <Table
          caption={`Danh sách công ty — ${companies.data.length} dòng`}
          sort={sort}
          onSort={toggleSort}
          headers={[
            { label: 'Tên', width: '28%', sortKey: 'name' },
            { label: 'Ngành', sortKey: 'industry' },
            'Loại hình',
            'Quốc gia',
            'Theo dõi',
            'Gợi ý',
          ]}
        >
          {sorted.map((company) => (
            <tr key={company.id}>
              <Cell>
                <Link
                  href={`/cong-ty/${company.id}`}
                  className="underline underline-offset-2 hover:text-ink-600"
                >
                  {company.name}
                </Link>
              </Cell>
              <Cell>{company.industry}</Cell>
              <Cell>{COMPANY_TYPE[company.companyType as keyof typeof COMPANY_TYPE]}</Cell>
              {/* Rule 4: an empty cell says it is empty. It never gets a plausible filler. */}
              <Cell>
                {company.country ?? <span className="text-ink-500">Chưa ghi quốc gia</span>}
              </Cell>
              <Cell>{company.isWatched ? <Badge tone="fact">Đang theo dõi</Badge> : null}</Cell>
              <Cell>
                <PendingProposalMarker count={pendingProposals[company.id]} />
              </Cell>
            </tr>
          ))}
        </Table>
      )}

      <Dialog open={isDialogOpen} onClose={() => setDialogOpen(false)} title="Thêm công ty">
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <Input
            label="Tên công ty"
            required
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
          />
          <Input
            label="Ngành"
            required
            value={form.industry}
            onChange={(event) => setForm({ ...form, industry: event.target.value })}
          />
          <Select
            label="Loại hình"
            value={form.companyType}
            onChange={(event) =>
              setForm({ ...form, companyType: event.target.value as CreateCompanyDto['companyType'] })
            }
          >
            {/* Codes come from contracts, labels from the same place — ontology 3.5 or nothing. */}
            {Object.entries(COMPANY_TYPE).map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </Select>

          {createCompany.isError && (
            <p role="alert" className="text-sm text-danger">
              {createCompany.error instanceof ApiError
                ? createCompany.error.message
                : 'Không tạo được công ty'}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setDialogOpen(false)}>
              Huỷ
            </Button>
            <Button type="submit" disabled={createCompany.isPending}>
              {createCompany.isPending ? 'Đang lưu…' : 'Lưu'}
            </Button>
          </div>
        </form>
      </Dialog>
    </PageBody>
  )
}

/**
 * One chip per filter that is actually on, each able to remove just itself. The labels repeat
 * the words on the controls above rather than inventing shorter ones — a chip that says
 * something the control does not is a second vocabulary for one idea.
 */
function filterChips(
  filters: ListCompaniesQuery,
  setFilters: (next: ListCompaniesQuery) => void,
): FilterChip[] {
  const chips: FilterChip[] = []
  const without = (key: keyof ListCompaniesQuery) => () =>
    setFilters({ ...filters, [key]: undefined })

  if (filters.q) chips.push({ label: `Tên: ${filters.q}`, onRemove: without('q') })
  if (filters.industry)
    chips.push({ label: `Ngành: ${filters.industry}`, onRemove: without('industry') })
  if (filters.companyType)
    chips.push({
      label: `Loại hình: ${COMPANY_TYPE[filters.companyType as keyof typeof COMPANY_TYPE]}`,
      onRemove: without('companyType'),
    })
  if (filters.country)
    chips.push({ label: `Quốc gia: ${filters.country}`, onRemove: without('country') })
  if (filters.isWatched !== undefined)
    chips.push({
      label: filters.isWatched ? 'Đang theo dõi' : 'Không theo dõi',
      onRemove: without('isWatched'),
    })

  return chips
}

function unique(values: string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b, 'vi'))
}
