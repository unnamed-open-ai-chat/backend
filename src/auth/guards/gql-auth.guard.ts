import { ExecutionContext, Injectable } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class GqlAuthGuard extends AuthGuard('jwt') {
    getRequest(httpCtx: ExecutionContext): any {
        const gqlCtx = GqlExecutionContext.create(httpCtx);
        const req = gqlCtx.getContext().req;
        return req;
    }
}
