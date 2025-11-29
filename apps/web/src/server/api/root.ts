import { router } from "./trpc";
import { researchRouter } from "./routers/research";

export const appRouter = router({
	research: researchRouter
});

export type AppRouter = typeof appRouter;

