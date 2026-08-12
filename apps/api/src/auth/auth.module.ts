import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'

import { AuthController } from './auth.controller'
import { AuthService } from './auth-service'
import { JwtGuard } from './jwt.guard'
import { RolesGuard } from './roles.guard'

const ONE_DAY = '1d'

@Module({
  imports: [
    JwtModule.registerAsync({
      useFactory: () => {
        const secret = process.env.JWT_SECRET
        // Better to refuse to start than to run with an empty key anyone can forge tokens with.
        if (!secret) throw new Error('Missing JWT_SECRET. Generate one: openssl rand -hex 32')
        return { secret, signOptions: { expiresIn: ONE_DAY } }
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtGuard, RolesGuard],
  exports: [JwtModule, JwtGuard, RolesGuard],
})
export class AuthModule {}
