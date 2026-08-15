import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'

import type { ImportSummaryDto } from '@crm/contracts'
import { AdminImportService } from './admin-import-service'
import { JwtGuard } from '../auth/jwt.guard'
import { Roles, RolesGuard } from '../auth/roles.guard'

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024

/**
 * The UI-facing replacement for spec 7 condition 5's "một lệnh": admin uploads the BTC zip,
 * this route wipes the current state and replaces it — exactly what `pnpm seed` does, triggered
 * from a browser instead of a terminal.
 *
 * `@Roles('admin')`: this is a destructive, whole-system reset. Sales must never reach it.
 */
@Controller('admin')
@UseGuards(JwtGuard, RolesGuard)
export class AdminImportController {
  constructor(private readonly importService: AdminImportService) {}

  @Post('import-data')
  @Roles('admin')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES } }))
  async importData(@UploadedFile() file?: Express.Multer.File): Promise<ImportSummaryDto> {
    if (!file) {
      throw new BadRequestException('Thiếu file — chọn file zip trước khi nạp')
    }
    if (!file.originalname.toLowerCase().endsWith('.zip')) {
      throw new BadRequestException('File phải là .zip')
    }
    try {
      return await this.importService.importZip(file.buffer)
    } catch (error) {
      throw new BadRequestException(
        `Không đọc được file: ${error instanceof Error ? error.message : 'lỗi không rõ'}`,
      )
    }
  }
}
