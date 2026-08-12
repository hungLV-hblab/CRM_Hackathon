import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common'
import type { Observable } from 'rxjs'

import { type Actor, humanActor, runWithActor } from './actor-context'
import type { AuthenticatedRequest } from '../../auth/jwt.guard'

/**
 * Binds an `actor` to the lifetime of one HTTP request.
 *
 * Everything arriving over HTTP is a HUMAN: `actor='system'` never originates here, it is
 * set explicitly in code by the worker and the AI branches. If some endpoint one day needs
 * to run under the system identity, that needs a new ADR — do not quietly widen this.
 */
@Injectable()
export class ActorInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>()
    const user = req.user

    const actor: Actor | undefined = user ? humanActor(user.sub, user.role) : undefined

    if (!actor) return next.handle()
    return runWithActor(actor, () => next.handle())
  }
}
