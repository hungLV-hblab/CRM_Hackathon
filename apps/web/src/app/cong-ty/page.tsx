'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'

import { COMPANY_TYPE, type CreateCompanyDto } from '@crm/contracts'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Input, Select } from '@/components/ui/input'
import { Cell, Table } from '@/components/ui/table'
import { api, ApiError } from '@/lib/api-client'

const EMPTY_FORM: CreateCompanyDto = { name: '', industry: '', companyType: 'traditional' }

export default function CompanyListPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [isDialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<CreateCompanyDto>(EMPTY_FORM)

  const companies = useQuery({ queryKey: ['companies'], queryFn: api.listCompanies })

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
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Công ty</h1>
        <div className="flex gap-2">
          <Button onClick={() => setDialogOpen(true)}>Thêm công ty</Button>
          <Button variant="ghost" onClick={onLogout}>
            Đăng xuất
          </Button>
        </div>
      </header>

      {companies.isPending && <p className="text-sm text-slate-500">Đang tải…</p>}

      {companies.isError && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {companies.error instanceof ApiError
            ? companies.error.message
            : 'Không tải được danh sách công ty'}
        </p>
      )}

      {companies.data && (
        <Table headers={['Tên', 'Ngành', 'Loại hình', 'Quốc gia', 'Theo dõi']}>
          {companies.data.map((company) => (
            <tr key={company.id}>
              <Cell>
                <Link
                  href={`/cong-ty/${company.id}`}
                  className="underline underline-offset-2 hover:text-slate-600"
                >
                  {company.name}
                </Link>
              </Cell>
              <Cell>{company.industry}</Cell>
              <Cell>{COMPANY_TYPE[company.companyType as keyof typeof COMPANY_TYPE]}</Cell>
              {/* Rule 4: an empty cell says it is empty. It never gets a plausible filler. */}
              <Cell>{company.country ?? <span className="text-slate-400">—</span>}</Cell>
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
            <p role="alert" className="text-sm text-red-700">
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
