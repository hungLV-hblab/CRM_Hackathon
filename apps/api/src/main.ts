import 'reflect-metadata'

import { Logger } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import cookieParser from 'cookie-parser'

import { AppModule } from './app.module'
import { WatchModule } from './watch/watch.module'

/**
 * ONE image, TWO roles (ADR-0011). `APP_ROLE` decides which module tree is loaded:
 *
 *   api    → HTTP, serves the user interface
 *   worker → opens NO HTTP port, runs the watch cycle only
 *
 * Sharing an image means the domain is never duplicated and the two deployables cannot drift
 * apart in version; running two containers means separate logs, so a judge can be pointed at
 * exactly where "the watch cycle is running".
 */
async function bootstrap(): Promise<void> {
  const role = process.env.APP_ROLE ?? 'api'

  if (role === 'worker') {
    // `createApplicationContext`, not `create`: the worker opens no port at all.
    const context = await NestFactory.createApplicationContext(WatchModule)
    context.enableShutdownHooks()
    new Logger('worker').log('Worker started, watch cycle running.')
    return
  }

  if (role !== 'api') {
    throw new Error(`Invalid APP_ROLE: "${role}". Only "api" or "worker" are accepted.`)
  }

  const app = await NestFactory.create(AppModule)
  app.use(cookieParser())
  // Caddy forwards `/api/*` UNCHANGED, it does not strip the prefix — fewer places to get wrong.
  app.setGlobalPrefix('api')
  app.enableShutdownHooks()

  const port = Number(process.env.API_PORT ?? 3001)
  await app.listen(port, '0.0.0.0')
  new Logger('api').log(`API listening on port ${port} under the /api prefix`)
}

bootstrap().catch((error) => {
  console.error('Failed to start:', error)
  process.exit(1)
})
