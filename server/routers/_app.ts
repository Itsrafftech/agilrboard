import { router } from "@/server/trpc";
import { userRouter } from "@/server/routers/user";
import { projectRouter } from "@/server/routers/project";
import { taskRouter } from "@/server/routers/task";
import { sprintRouter } from "@/server/routers/sprint";
import { reportRouter } from "@/server/routers/report";

export const appRouter = router({
  user: userRouter,
  project: projectRouter,
  task: taskRouter,
  sprint: sprintRouter,
  report: reportRouter,
});

export type AppRouter = typeof appRouter;
