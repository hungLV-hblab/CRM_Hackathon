import { Module } from '@nestjs/common'

import { AdminImportController } from './admin-import.controller'
import { AdminImportService } from './admin-import-service'
import { AuthModule } from '../auth/auth.module'

@Module({
  imports: [AuthModule],
  controllers: [AdminImportController],
  providers: [AdminImportService],
})
export class AdminModule {}
