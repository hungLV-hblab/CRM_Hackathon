import { BadRequestException, type PipeTransform } from '@nestjs/common'
import type { ZodType, ZodTypeDef } from 'zod'

/**
 * Input validation runs off the very schema declared in `@crm/contracts`, so the frontend
 * and the API share ONE definition instead of two hand-written ones that drift apart.
 * The message is Vietnamese because it reaches Sales.
 *
 * The schema's INPUT type is left free (`unknown`) rather than pinned to its output. A query
 * string carries only strings, so the schemas that read one necessarily transform — `page` from
 * `"2"` to `2`, `unreadOnly` from `"false"` to `false` — and a signature demanding the two types
 * match would reject exactly the schemas this pipe exists to run. What the caller gets back is
 * still the parsed output type.
 */
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodType<T, ZodTypeDef, unknown>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value)
    if (!result.success) {
      throw new BadRequestException({
        message: 'Dữ liệu gửi lên không hợp lệ',
        issues: result.error.issues.map((issue) => ({
          field: issue.path.join('.'),
          problem: issue.message,
        })),
      })
    }
    return result.data
  }
}
