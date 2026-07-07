import { PrismaClient, TaskStatus, TaskPriority } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const password = await bcrypt.hash("password123", 10);

  const [alice, bob, carol] = await Promise.all([
    prisma.user.upsert({
      where: { email: "alice@agileboard.dev" },
      update: {},
      create: { name: "Alice Chen", email: "alice@agileboard.dev", password },
    }),
    prisma.user.upsert({
      where: { email: "bob@agileboard.dev" },
      update: {},
      create: { name: "Bob Martinez", email: "bob@agileboard.dev", password },
    }),
    prisma.user.upsert({
      where: { email: "carol@agileboard.dev" },
      update: {},
      create: { name: "Carol Nguyen", email: "carol@agileboard.dev", password },
    }),
  ]);

  const project = await prisma.project.create({
    data: {
      name: "AgileBoard Demo",
      description: "A demo project showcasing sprints, boards, and reporting.",
      key: "AGB",
      ownerId: alice.id,
      projectMembers: {
        create: [
          { userId: alice.id, role: "ADMIN" },
          { userId: bob.id, role: "MEMBER" },
          { userId: carol.id, role: "MEMBER" },
        ],
      },
      labels: {
        create: [
          { name: "Bug", color: "#ef4444" },
          { name: "Feature", color: "#6366f1" },
          { name: "Design", color: "#ec4899" },
          { name: "Docs", color: "#22c55e" },
        ],
      },
    },
  });

  const labels = await prisma.label.findMany({ where: { projectId: project.id } });
  const labelByName = (name: string) => labels.find((l) => l.name === name)!;

  const now = new Date();
  const sprintStart = new Date(now);
  sprintStart.setDate(now.getDate() - 4);
  const sprintEnd = new Date(now);
  sprintEnd.setDate(now.getDate() + 10);

  const activeSprint = await prisma.sprint.create({
    data: {
      projectId: project.id,
      name: "Sprint 1",
      goal: "Ship the core Kanban board and sprint planning flow.",
      startDate: sprintStart,
      endDate: sprintEnd,
      status: "ACTIVE",
    },
  });

  const priorPast = new Date(sprintStart);
  priorPast.setDate(sprintStart.getDate() - 14);
  await prisma.sprint.create({
    data: {
      projectId: project.id,
      name: "Sprint 0",
      goal: "Project setup and scaffolding.",
      startDate: priorPast,
      endDate: sprintStart,
      status: "COMPLETED",
    },
  });

  type SeedTask = {
    title: string;
    description: string;
    status: TaskStatus;
    priority: TaskPriority;
    storyPoints: number;
    sprintId: string | null;
    assigneeId: string | null;
    label: string;
    daysFromNow?: number;
  };

  const activeSprintTasks: SeedTask[] = [
    {
      title: "Set up drag-and-drop board columns",
      description: "Implement To Do / In Progress / In Review / Done columns with @dnd-kit.",
      status: "DONE",
      priority: "HIGH",
      storyPoints: 5,
      sprintId: activeSprint.id,
      assigneeId: alice.id,
      label: "Feature",
    },
    {
      title: "Card creation modal",
      description: "Title, description, assignee, priority, due date fields.",
      status: "DONE",
      priority: "MEDIUM",
      storyPoints: 3,
      sprintId: activeSprint.id,
      assigneeId: bob.id,
      label: "Feature",
    },
    {
      title: "Priority color coding",
      description: "Low/Medium/High/Critical color-coded badges on cards.",
      status: "IN_REVIEW",
      priority: "LOW",
      storyPoints: 2,
      sprintId: activeSprint.id,
      assigneeId: carol.id,
      label: "Design",
    },
    {
      title: "Sprint velocity tracking",
      description: "Compute story points completed per sprint for burndown reporting.",
      status: "IN_PROGRESS",
      priority: "HIGH",
      storyPoints: 8,
      sprintId: activeSprint.id,
      assigneeId: alice.id,
      label: "Feature",
    },
    {
      title: "Fix drag ghost flicker on Safari",
      description: "Card preview flickers when dragging across columns in Safari.",
      status: "IN_PROGRESS",
      priority: "CRITICAL",
      storyPoints: 3,
      sprintId: activeSprint.id,
      assigneeId: bob.id,
      label: "Bug",
      daysFromNow: 2,
    },
    {
      title: "Assignee filter on board",
      description: "Filter visible cards by assignee dropdown above the board.",
      status: "TODO",
      priority: "MEDIUM",
      storyPoints: 2,
      sprintId: activeSprint.id,
      assigneeId: carol.id,
      label: "Feature",
      daysFromNow: 4,
    },
    {
      title: "Workload heatmap chart",
      description: "Recharts bar chart of task count and story points per member.",
      status: "TODO",
      priority: "MEDIUM",
      storyPoints: 5,
      sprintId: activeSprint.id,
      assigneeId: alice.id,
      label: "Feature",
      daysFromNow: 6,
    },
    {
      title: "Write onboarding docs",
      description: "Document setup steps for new contributors in README.",
      status: "TODO",
      priority: "LOW",
      storyPoints: 1,
      sprintId: activeSprint.id,
      assigneeId: null,
      label: "Docs",
    },
  ];

  const backlogTasks: SeedTask[] = [
    {
      title: "Cumulative flow diagram",
      description: "Stacked area chart of task counts per status over time.",
      status: "BACKLOG",
      priority: "MEDIUM",
      storyPoints: 5,
      sprintId: null,
      assigneeId: null,
      label: "Feature",
    },
    {
      title: "PDF report export",
      description: "Export the reports page as a PDF via html2canvas + jsPDF.",
      status: "BACKLOG",
      priority: "LOW",
      storyPoints: 3,
      sprintId: null,
      assigneeId: bob.id,
      label: "Feature",
    },
    {
      title: "Google OAuth login",
      description: "Add Google sign-in alongside credentials auth.",
      status: "BACKLOG",
      priority: "HIGH",
      storyPoints: 3,
      sprintId: null,
      assigneeId: alice.id,
      label: "Feature",
    },
    {
      title: "Mobile board horizontal scroll",
      description: "Ensure board columns scroll horizontally on small screens.",
      status: "BACKLOG",
      priority: "MEDIUM",
      storyPoints: 2,
      sprintId: null,
      assigneeId: null,
      label: "Design",
    },
    {
      title: "Task comments thread",
      description: "Allow team members to comment on a task card.",
      status: "BACKLOG",
      priority: "LOW",
      storyPoints: 3,
      sprintId: null,
      assigneeId: carol.id,
      label: "Feature",
    },
    {
      title: "Invite by email flow",
      description: "Send project invites by email with role selection.",
      status: "BACKLOG",
      priority: "CRITICAL",
      storyPoints: 5,
      sprintId: null,
      assigneeId: null,
      label: "Feature",
    },
  ];

  const allTasks = [...activeSprintTasks, ...backlogTasks];

  for (let i = 0; i < allTasks.length; i++) {
    const t = allTasks[i];
    let dueDate: Date | null = null;
    if (t.daysFromNow !== undefined) {
      dueDate = new Date(now);
      dueDate.setDate(now.getDate() + t.daysFromNow);
    }

    await prisma.task.create({
      data: {
        projectId: project.id,
        sprintId: t.sprintId,
        title: t.title,
        description: t.description,
        status: t.status,
        priority: t.priority,
        storyPoints: t.storyPoints,
        dueDate,
        position: i,
        assigneeId: t.assigneeId,
        creatorId: alice.id,
        labels: { connect: [{ id: labelByName(t.label).id }] },
      },
    });
  }

  console.log("Seed complete:");
  console.log(`  Users: ${[alice, bob, carol].map((u) => u.email).join(", ")}`);
  console.log(`  Password for all demo users: password123`);
  console.log(`  Project: ${project.name} (${project.key})`);
  console.log(`  Sprints: Sprint 0 (completed), Sprint 1 (active)`);
  console.log(`  Tasks: ${allTasks.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
