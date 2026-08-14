'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'

import { COMPANY_TYPE, type CompanyDto, type UpdateCompanyDto } from '@crm/contracts'

import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/input'
import { api, ApiError } from '@/lib/api-client'

/**
 * "Hồ sơ" — Sales' official data. White surface, no machine hue anywhere: everything here was
 * typed by a person, and rule 2 of CLAUDE.md is answered by the surface itself.
 *
 * EVERY cell is editable, `companyType` included. I-11 forbids a `Proposal` from touching the
 * lens signals are read under; it says nothing about the person who typed it and now needs to
 * fix a typo.
 */
export function CompanyProfileSection({ company }: { company: CompanyDto }) {
  const queryClient = useQueryClient()
  const [isEditing, setEditing] = useState(false)
  const [form, setForm] = useState<UpdateCompanyDto>({})

  const update = useMutation({
    mutationFn: (dto: UpdateCompanyDto) => api.updateCompany(company.id, dto),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['company', company.id] })
      await queryClient.invalidateQueries({ queryKey: ['companies'] })
      setEditing(false)
      setForm({})
    },
  })

  function startEditing() {
    setForm({
      name: company.name,
      industry: company.industry,
      companyType: company.companyType as UpdateCompanyDto['companyType'],
      country: company.country ?? undefined,
      size: company.size ?? undefined,
      website: company.website ?? undefined,
      isWatched: company.isWatched,
    })
    setEditing(true)
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    update.mutate(form)
  }

  if (!isEditing) {
    return (
      <section className="rounded-card border border-ink-200 bg-card p-4">
        <header className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-500">Hồ sơ</h2>
          <Button variant="secondary" onClick={startEditing}>
            Sửa hồ sơ
          </Button>
        </header>
        <dl className="grid gap-3 sm:grid-cols-2">
          <Field label="Ngành" value={company.industry} />
          <Field
            label="Loại hình"
            value={COMPANY_TYPE[company.companyType as keyof typeof COMPANY_TYPE]}
          />
          <Field label="Quốc gia" value={company.country} />
          <Field label="Quy mô" value={company.size} />
          <Field label="Website" value={company.website} />
          <Field label="Theo dõi" value={company.isWatched ? 'Đang theo dõi' : 'Không theo dõi'} />
        </dl>
      </section>
    )
  }

  return (
    <section className="rounded-card border border-ink-200 bg-card p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-500">
        Sửa hồ sơ
      </h2>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label="Tên công ty"
            value={form.name ?? ''}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
          />
          <Input
            label="Ngành"
            value={form.industry ?? ''}
            onChange={(event) => setForm({ ...form, industry: event.target.value })}
          />
          <Select
            label="Loại hình"
            value={form.companyType ?? 'traditional'}
            onChange={(event) =>
              setForm({ ...form, companyType: event.target.value as UpdateCompanyDto['companyType'] })
            }
          >
            {Object.entries(COMPANY_TYPE).map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </Select>
          <Input
            label="Quốc gia"
            value={form.country ?? ''}
            onChange={(event) => setForm({ ...form, country: event.target.value })}
          />
          <Input
            label="Quy mô"
            value={form.size ?? ''}
            onChange={(event) => setForm({ ...form, size: event.target.value })}
          />
          <Input
            label="Website"
            value={form.website ?? ''}
            onChange={(event) => setForm({ ...form, website: event.target.value })}
          />
        </div>

        <label className="flex min-h-11 items-center gap-2 text-sm text-ink-700">
          <input
            type="checkbox"
            checked={form.isWatched ?? false}
            onChange={(event) => setForm({ ...form, isWatched: event.target.checked })}
            className="size-4 accent-brand-500"
          />
          Đang theo dõi — bật thì vòng quét được thêm mục vào dòng thời gian
        </label>

        {update.isError && (
          <p role="alert" className="text-sm text-danger">
            {update.error instanceof ApiError ? update.error.message : 'Không lưu được hồ sơ'}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => setEditing(false)}>
            Huỷ
          </Button>
          <Button type="submit" disabled={update.isPending}>
            {update.isPending ? 'Đang lưu…' : 'Lưu'}
          </Button>
        </div>
      </form>
    </section>
  )
}

/** Rule 4: an empty cell says WHY it is empty. Never a bare dash. */
function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-ink-500">{label}</dt>
      <dd className="text-fact">
        {value ?? <span className="text-sm text-ink-500">Chưa có, Sales bổ sung sau</span>}
      </dd>
    </div>
  )
}
