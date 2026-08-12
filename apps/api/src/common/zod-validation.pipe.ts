import { BadRequestException, type PipeTransform } from '@nestjs/common'
import type { ZodSchema } from 'zod'

/**
 * Input validation runs off the very schema declared in `@crm/contracts`, so the frontend
 * and the API share ONE definition instead of two hand-written ones that drift apart.
 * The message is Vietnamese because it reaches Sales.
 */
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodSchema<T>) {}

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
