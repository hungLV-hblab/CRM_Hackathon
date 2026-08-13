'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState, type FormEvent } from 'react'

import { COMPANY_TYPE, type CreateCompanyDto, type ListCompaniesQuery } from '@crm/contracts'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Input, Select } from '@/components/ui/input'
import { Cell, Table } from '@/components/ui/table'
import { api, ApiError } from '@/lib/api-client'

const EMPTY_FORM: CreateCompanyDto = { name: '', industry: '', companyType: 'traditional' }
const EMPTY_FILTERS: ListCompaniesQuery = {}

export default function CompanyListPage() {
  const router = useRouter()
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
  const industries = useMemo(
    () => unique((allCompanies.data ?? []).map((row) => row.industry)),
    [allCompanies.data],
  )
  const countries = useMemo(
    () => unique((allCompanies.data ?? []).map((row) => row.country).filter(Boolean) as string[]),
    [allCompanies.data],
  )

  const createCompany = useMutation({
    mutationFn: api.createCompany,
    onSuccess: async () => {
      // Refetch rather than pushing the new row into the cache by hand: the server owns
      // fields the form never sent (`id`, `isWatched`), and inventing them locally is how a
      // list starts disagreeing with the database.
      await queryClient.invalidateQueries({ queryKey: ['companies'] })
      setDialogOpen(false)
      setForm(EMPTY_FORM)
    },
  })

  async function onLogout() {
    await api.logout()
    router.push('/dang-nhap')
    router.refresh()
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    createCompany.mutate(form)
  }

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Công ty</h1>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" onClick={() => router.push('/tong-quan')}>
            Tổng quan
          </Button>
          <Button variant="ghost" onClick={() => router.push('/co-hoi')}>
            Cơ hội
          </Button>
          <Button onClick={() => setDialogOpen(true)}>Thêm công ty</Button>
          <Button variant="ghost" onClick={onLogout}>
            Đăng xuất
          </Button>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
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
      </section>

      {companies.isPending && <p className="text-sm text-ink-500">Đang tải…</p>}

      {companies.isError && (
        <p role="alert" className="rounded-control bg-danger-surface px-3 py-2 text-sm text-danger">
          {companies.error instanceof ApiError
            ? companies.error.message
            : 'Không tải được danh sách công ty'}
        </p>
      )}

      {companies.data?.length === 0 && (
        <div className="rounded-card border border-dashed border-ink-300 p-6 text-center">
          <p className="text-sm text-ink-600">Không có công ty nào khớp bộ lọc đang chọn.</p>
          <Button variant="secondary" className="mt-3" onClick={() => setFilters(EMPTY_FILTERS)}>
            Xoá bộ lọc
          </Button>
        </div>
      )}

      {companies.data && companies.data.length > 0 && (
        <Table headers={['Tên', 'Ngành', 'Loại hình', 'Quốc gia', 'Theo dõi']}>
          {companies.data.map((company) => (
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
    </main>
  )
}

function unique(values: string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b, 'vi'))
}
