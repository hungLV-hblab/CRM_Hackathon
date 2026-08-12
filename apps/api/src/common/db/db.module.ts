import { Global, Inject, Module, type OnApplicationShutdown } from '@nestjs/common'

import { type CrmConnection, createAppConnection, createSystemConnection } from '@crm/db'

/**
 * Two tokens, two IDENTITIES at the database level (ADR-0010). This is the second defence
 * layer — picking the wrong token removes it, and removes it silently.
 *
 * The rule: services touching Sales' official data may only inject `DRIZZLE_APP`; services
 * of the AI branch and the worker may only inject `DRIZZLE_SYSTEM`. A service that genuinely
 * needs both (`OpportunityService`, because humans and the system both write the next step)
 * picks the pool BY ACTOR, never by whichever is at hand.
 */
export const DRIZZLE_APP = 'DRIZZLE_APP'
export const DRIZZLE_SYSTEM = 'DRIZZLE_SYSTEM'

const APP_CONNECTION = 'APP_CONNECTION'
const SYSTEM_CONNECTION = 'SYSTEM_CONNECTION'

@Global()
@Module({
  providers: [
    { provide: APP_CONNECTION, useFactory: createAppConnection },
    { provide: SYSTEM_CONNECTION, useFactory: createSystemConnection },
    {
      provide: DRIZZLE_APP,
      inject: [APP_CONNECTION],
      useFactory: (connection: CrmConnection) => connection.db,
    },
    {
      provide: DRIZZLE_SYSTEM,
      inject: [SYSTEM_CONNECTION],
      useFactory: (connection: CrmConnection) => connection.db,
    },
  ],
  exports: [DRIZZLE_APP, DRIZZLE_SYSTEM],
})
export class DbModule implements OnApplicationShutdown {
  constructor(
    @Inject(APP_CONNECTION) private readonly appConnection: CrmConnection,
    @Inject(SYSTEM_CONNECTION) private readonly systemConnection: CrmConnection,
  ) {}

  /** Leave the pools open and the process never exits, which hangs e2e until timeout. */
  async onApplicationShutdown(): Promise<void> {
    await Promise.allSettled([this.appConnection.close(), this.systemConnection.close()])
  }
}
