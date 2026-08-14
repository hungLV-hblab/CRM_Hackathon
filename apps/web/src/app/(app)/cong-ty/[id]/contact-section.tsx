'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'

import type { CreateContactDto } from '@crm/contracts'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { SectionCard } from '@/components/ui/section-card'
import { api, ApiError } from '@/lib/api-client'

/**
 * "Người liên hệ", with exactly one đầu mối chính. Promoting somebody demotes the previous
 * PIC in one request — the screen never asks Sales to untick the old person first, because
 * "this person is now the main contact" already says what happens to the other one.
 */
export function ContactSection({ companyId }: { companyId: string }) {
  const queryClient = useQueryClient()
  const [isDialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState({ name: '', title: '', email: '' })

  const contacts = useQuery({
    queryKey: ['contacts', companyId],
    queryFn: () => api.listContacts(companyId),
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['contacts', companyId] })

  const create = useMutation({
    mutationFn: (dto: CreateContactDto) => api.createContact(dto),
    onSuccess: async () => {
      await invalidate()
      setForm({ name: '', title: '', email: '' })
      setDialogOpen(false)
    },
  })

  const promote = useMutation({
    mutationFn: (contactId: string) => api.updateContact(contactId, { isPrimary: true }),
    onSuccess: invalidate,
  })

  const remove = useMutation({
    mutationFn: (contactId: string) => api.deleteContact(contactId),
    onSuccess: invalidate,
  })

  function submit(event: FormEvent) {
    event.preventDefault()
    create.mutate({
      companyId,
      name: form.name,
      ...(form.title.trim() ? { title: form.title.trim() } : {}),
      ...(form.email.trim() ? { email: form.email.trim() } : {}),
    })
  }

  return (
    <SectionCard
      title="Người liên hệ"
      actions={
        <Button variant="secondary" onClick={() => setDialogOpen(true)}>
          Thêm người liên hệ
        </Button>
      }
    >

      {contacts.isPending && <Skeleton className="h-40 w-full rounded-card" />}

      {contacts.data?.length === 0 && (
        <EmptyState message="Chưa có người liên hệ nào. Thêm đầu mối chính để biết gọi cho ai." compact />
      )}

      <ul className="flex flex-col divide-y divide-ink-200">
        {contacts.data?.map((contact) => (
          <li key={contact.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
            <div>
              <p className="flex items-center gap-2 text-sm font-medium text-ink-900">
                {contact.name}
                {contact.isPrimary && <Badge tone="fact">Đầu mối chính</Badge>}
              </p>
              <p className="text-xs text-ink-600">
                {contact.title ?? 'Chưa ghi chức danh'} · {contact.email ?? 'Chưa ghi email'}
              </p>
            </div>
            <div className="flex gap-2">
              {!contact.isPrimary && (
                <Button
                  variant="secondary"
                  disabled={promote.isPending}
                  onClick={() => promote.mutate(contact.id)}
                >
                  Đặt làm đầu mối chính
                </Button>
              )}
              {/* Destructive action, kept apart from the rest and never wearing the brand. */}
              <Button
                variant="danger"
                disabled={remove.isPending}
                onClick={() => remove.mutate(contact.id)}
              >
                Xoá
              </Button>
            </div>
          </li>
        ))}
      </ul>

      {(promote.isError || remove.isError) && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {(promote.error ?? remove.error) instanceof ApiError
            ? ((promote.error ?? remove.error) as ApiError).message
            : 'Không cập nhật được người liên hệ'}
        </p>
      )}

      <Dialog open={isDialogOpen} onClose={() => setDialogOpen(false)} title="Thêm người liên hệ">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <Input
            label="Tên"
            required
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
          />
          <Input
            label="Chức danh"
            value={form.title}
            onChange={(event) => setForm({ ...form, title: event.target.value })}
          />
          <Input
            label="Email"
            type="email"
            value={form.email}
            onChange={(event) => setForm({ ...form, email: event.target.value })}
          />

          {create.isError && (
            <p role="alert" className="text-sm text-danger">
              {create.error instanceof ApiError
                ? create.error.message
                : 'Không thêm được người liên hệ'}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setDialogOpen(false)}>
              Huỷ
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? 'Đang lưu…' : 'Lưu'}
            </Button>
          </div>
        </form>
      </Dialog>
    </SectionCard>
  )
}
