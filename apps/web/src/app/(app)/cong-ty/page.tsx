'use client'

import { Plus, Search } from 'lucide-react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { useMemo, useState, type FormEvent } from 'react'

import { type CreateCompanyDto, type ListCompaniesQuery } from '@crm/contracts'

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

const EMPTY_FORM: CreateCompanyDto = { name: '', industry: '', companyType: '' }
const EMPTY_FILTERS: ListCompaniesQuery = {}
/** One screen of rows. Changing a filter or the sort sends the reader back to page one. */
const PAGE_SIZE = 20

export default function CompanyListPage() {
  const queryClient = useQueryClient()
  const [isDialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<CreateCompanyDto>(EMPTY_FORM)
  const [filters, setFiltersState] = useState<ListCompaniesQuery>(EMPTY_FILTERS)

  /**
   * Every filter change goes back to page one. Narrowing a list while standing on page four
   * usually lands past the end of the new result — an empty table that reads as "nothing
   * matched" when the matches are simply on page one.
   */
  function setFilters(next: ListCompaniesQuery) {
    setFiltersState(next)
    setPage(1)
  }

  /**
   * Filtering happens on the server, so the key carries the filters: two different filter
   * sets are two different results and must not share a cache entry.
   */
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState<TableSort | undefined>(undefined)

  const listQuery: ListCompaniesQuery = {
    ...filters,
    page,
    pageSize: PAGE_SIZE,
    sortBy: sort?.key === 'industry' ? 'industry' : sort ? 'name' : undefined,
    sortDir: sort?.direction,
  }

  const companies = useQuery({
    queryKey: ['companies', listQuery],
    queryFn: () => api.listCompanies(listQuery),
    /** Turning a page keeps the current rows on screen instead of flashing an empty table. */
    placeholderData: keepPreviousData,
  })

  /**
   * The dropdown options come from what is actually stored, not from a hard-coded list:
   * industry and country are free text, so a fixed list would go stale the first time
   * somebody types a new one. Read from an unfiltered fetch so choosing one filter never
   * empties the other dropdown.
   */
  /**
   * ITS OWN KEY, not `['companies', {}]`. That key is already owned by the command palette with a
   * different `queryFn`, and TanStack Query stores one entry per key — opening ⌘K first would
   * have filled this one and built the dropdowns from whatever the palette asked for. The name
   * says what it is for: the distinct values behind the filters, never a paged view.
   */
  const allCompanies = useQuery({
    queryKey: ['company-facets'],
    queryFn: () => api.listCompanies(),
  })
  /** Specs group 3: the list must show which companies have something waiting for a decision. */
  const pendingProposals = usePendingProposalCounts()
  const facets = allCompanies.data?.items ?? []
  const industries = useMemo(() => unique(facets.map((row) => row.industry)), [facets])
  const countries = useMemo(
    () => unique(facets.map((row) => row.country).filter(Boolean) as string[]),
    [facets],
  )
  /**
   * `companyType` is free text (schema migration 0012) — no fixed dictionary to render a
   * dropdown from anymore. Same pattern as `industries`/`countries` above: the filter options
   * are whatever values are actually in the data, not a hand-typed 5-value list.
   */
  const companyTypes = useMemo(
    () => unique(facets.map((row) => row.companyType)),
    [facets],
  )

  /**
   * The screen reports the click; the SERVER decides the order (ADR-0047).
   *
   * It used to sort here with `localeCompare(..., 'vi')`, which was right while the whole list
   * was in the browser. Once the list is paged that becomes sorting one page — the rows on page
   * two never enter the comparison — and the result looks ordered while being wrong. Postgres
   * does it now, and `company-list-pagination.test.ts` asserts the Vietnamese ordering rather
   * than trusting it: Đ after D, and the diacritics in vowel order.
   */
  function toggleSort(key: string) {
    setPage(1)
    setSort((current) =>
      current?.key === key
        ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'asc' },
    )
  }

  const sorted = companies.data?.items ?? []
  const total = companies.data?.total ?? 0
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE))

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
        actions={
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="size-4" aria-hidden />
            Thêm công ty
          </Button>
        }
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
          {companyTypes.map((type) => (
            <option key={type} value={type}>
              {type}
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

      {companies.isPending && <TableSkeleton rows={6} />}

      {companies.isError && (
        <ErrorState error={companies.error} fallback={'Không tải được danh sách công ty'} />
      )}

      {/* No "Xoá bộ lọc" button here any more. The filter bar above carries one whenever a
          filter is on, and two buttons with the same name are ambiguous to a screen reader and
          to `getByRole` alike — the way out has to be in exactly one place. */}
      {companies.data && total === 0 && (
        <EmptyState message="Không có công ty nào khớp bộ lọc đang chọn. Bỏ bớt điều kiện ở thanh lọc phía trên để xem lại danh sách." icon={Search} />
      )}

      {companies.data && total > 0 && (
        <Table
          caption={`Danh sách công ty — ${sorted.length}/${total} dòng`}
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
              <Cell>{company.companyType}</Cell>
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

      {lastPage > 1 && (
        <nav aria-label="Phân trang công ty" className="flex items-center gap-3">
          <Button variant="ghost" disabled={page <= 1} onClick={() => setPage((n) => n - 1)}>
            ← Trang trước
          </Button>
          <span className="text-sm text-ink-600">
            Trang {page}/{lastPage} · {total} công ty
          </span>
          <Button
            variant="ghost"
            disabled={page >= lastPage}
            onClick={() => setPage((n) => n + 1)}
          >
            Trang sau →
          </Button>
        </nav>
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
          <Input
            label="Loại hình"
            required
            list="company-type-suggestions"
            value={form.companyType}
            onChange={(event) => setForm({ ...form, companyType: event.target.value })}
          />
          {/* Text tự do (schema migration 0012) — datalist chỉ gợi ý, không ép chọn. */}
          <datalist id="company-type-suggestions">
            {companyTypes.map((type) => (
              <option key={type} value={type} />
            ))}
          </datalist>

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
      label: `Loại hình: ${filters.companyType}`,
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

/** Shaped like the table that is coming: one header band, then rows at row height. */
function TableSkeleton({ rows }: { rows: number }) {
  return (
    <div className="overflow-hidden rounded-card border border-ink-200 bg-surface shadow-card">
      <Skeleton className="h-12 w-full rounded-none" />
      <div className="flex flex-col gap-px p-px">
        {Array.from({ length: rows }, (_, index) => (
          <Skeleton key={index} className="h-12 w-full rounded-none" />
        ))}
      </div>
    </div>
  )
}

function unique(values: string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b, 'vi'))
}
