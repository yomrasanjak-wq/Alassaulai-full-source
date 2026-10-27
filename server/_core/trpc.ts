import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";
import { ENV } from "./env";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    const isOwner = Boolean(ENV.ownerOpenId && ctx.user?.openId === ENV.ownerOpenId);
    if (!ctx.user || (ctx.user.role !== 'admin' && !isOwner)) {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);


// Owner-only procedure for consequential governance decisions. Fail closed if the
// deployment has not configured the platform owner's stable identity.
export const ownerProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;
    if (!ENV.ownerOpenId || !ctx.user || ctx.user.openId !== ENV.ownerOpenId) {
      throw new TRPCError({ code: "FORBIDDEN", message: "يتطلب هذا الإجراء موافقة مالك المنصة." });
    }
    return next({ ctx: { ...ctx, user: ctx.user } });
  }),
);
