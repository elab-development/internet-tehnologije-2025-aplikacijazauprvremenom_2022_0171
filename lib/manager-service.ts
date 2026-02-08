import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  adminAuditLogs,
  calendarEvents,
  categories,
  notes,
  reminders,
  session,
  tasks,
  todoLists,
  user,
} from "@/db/schema";
import {
  canActorAccessUser,
  isManagerOfUser,
  type SessionActor,
} from "@/lib/api-utils";
import { isAdmin, isManager, type UserRole } from "@/lib/roles";

export class ServiceError extends Error {
  status: number;
  details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

type AssignUserToManagerInput = {
  adminId: string;
  userId: string;
  managerId: string | null;
};

type RemoveManagerRoleInput = {
  adminId: string;
  managerUserId: string;
  nextRole: Exclude<UserRole, "manager">;
};

type CreateManagerTaskInput = {
  managerId: string;
  targetUserId: string;
  listId: string;
  categoryId: string | null;
  title: string;
  description: string | null;
  priority: "low" | "medium" | "high";
  status: "not_started" | "in_progress" | "done";
  dueDate: Date | null;
  completedAt: Date | null;
  estimatedMinutes: number;
};

type UpdateTaskStatusInput = {
  actor: SessionActor;
  taskId: string;
  status: "not_started" | "in_progress" | "done";
  completedAt?: Date | null;
};

type DeleteTaskInput = {
  actor: SessionActor;
  taskId: string;
};

async function assertManagerActor(managerId: string) {
  const managerUser = await db.query.user.findFirst({
    where: eq(user.id, managerId),
    columns: { id: true, role: true, isActive: true },
  });

  if (!managerUser || !isManager(managerUser.role) || !managerUser.isActive) {
    throw new ServiceError(403, "Forbidden");
  }
}

export async function assignUserToManager(input: AssignUserToManagerInput) {
  const managerId = input.managerId?.trim() || null;

  return db.transaction(async (tx) => {
    const adminUser = await tx.query.user.findFirst({
      where: eq(user.id, input.adminId),
      columns: { id: true, role: true, isActive: true },
    });

    if (!adminUser || !isAdmin(adminUser.role) || !adminUser.isActive) {
      throw new ServiceError(403, "Forbidden");
    }

    const targetUser = await tx.query.user.findFirst({
      where: eq(user.id, input.userId),
      columns: { id: true, role: true, managerId: true },
    });

    if (!targetUser) {
      throw new ServiceError(404, "User not found");
    }

    if (targetUser.role !== "user") {
      throw new ServiceError(400, "Only USER can be assigned to manager");
    }

    if (managerId) {
      if (managerId === targetUser.id) {
        throw new ServiceError(400, "User cannot be assigned to themselves");
      }

      const managerUser = await tx.query.user.findFirst({
        where: eq(user.id, managerId),
        columns: { id: true, role: true, isActive: true },
      });

      if (!managerUser || managerUser.role !== "manager" || !managerUser.isActive) {
        throw new ServiceError(400, "Target manager is invalid or inactive");
      }
    }

    const [updatedUser] = await tx
      .update(user)
      .set({ managerId })
      .where(eq(user.id, targetUser.id))
      .returning({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        managerId: user.managerId,
        isActive: user.isActive,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      });

    await tx.insert(adminAuditLogs).values({
      adminId: input.adminId,
      targetUserId: targetUser.id,
      action: managerId ? "assign_user_to_manager" : "unassign_user_from_manager",
      details: JSON.stringify({
        previousManagerId: targetUser.managerId,
        nextManagerId: managerId,
      }),
    });

    return updatedUser;
  });
}

export async function removeManagerRole(input: RemoveManagerRoleInput) {
  return db.transaction(async (tx) => {
    const adminUser = await tx.query.user.findFirst({
      where: eq(user.id, input.adminId),
      columns: { id: true, role: true, isActive: true },
    });

    if (!adminUser || !isAdmin(adminUser.role) || !adminUser.isActive) {
      throw new ServiceError(403, "Forbidden");
    }

    const managerUser = await tx.query.user.findFirst({
      where: eq(user.id, input.managerUserId),
      columns: { id: true, role: true, isActive: true },
    });

    if (!managerUser) {
      throw new ServiceError(404, "User not found");
    }

    if (managerUser.role !== "manager") {
      throw new ServiceError(400, "Target user is not a manager");
    }

    const deletedReminders = await tx
      .delete(reminders)
      .where(eq(reminders.createdByUserId, managerUser.id))
      .returning({ id: reminders.id });

    const deletedEvents = await tx
      .delete(calendarEvents)
      .where(eq(calendarEvents.createdByUserId, managerUser.id))
      .returning({ id: calendarEvents.id });

    const deletedTasks = await tx
      .delete(tasks)
      .where(eq(tasks.createdByUserId, managerUser.id))
      .returning({ id: tasks.id });

    const deletedNotes = await tx
      .delete(notes)
      .where(eq(notes.createdByUserId, managerUser.id))
      .returning({ id: notes.id });

    const deletedCategories = await tx
      .delete(categories)
      .where(eq(categories.createdByUserId, managerUser.id))
      .returning({ id: categories.id });

    const teamMembers = await tx
      .update(user)
      .set({ managerId: null })
      .where(eq(user.managerId, managerUser.id))
      .returning({ id: user.id });

    const [updatedUser] = await tx
      .update(user)
      .set({
        role: input.nextRole,
        managerId: null,
      })
      .where(eq(user.id, managerUser.id))
      .returning({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        managerId: user.managerId,
        isActive: user.isActive,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      });

    await tx.delete(session).where(eq(session.userId, managerUser.id));

    await tx.insert(adminAuditLogs).values({
      adminId: input.adminId,
      targetUserId: managerUser.id,
      action: "remove_manager_role",
      details: JSON.stringify({
        nextRole: input.nextRole,
        deleted: {
          reminders: deletedReminders.length,
          events: deletedEvents.length,
          tasks: deletedTasks.length,
          notes: deletedNotes.length,
          categories: deletedCategories.length,
        },
        unassignedUsersCount: teamMembers.length,
      }),
    });

    return {
      user: updatedUser,
      deleted: {
        reminders: deletedReminders.length,
        events: deletedEvents.length,
        tasks: deletedTasks.length,
        notes: deletedNotes.length,
        categories: deletedCategories.length,
      },
      unassignedUsersCount: teamMembers.length,
    };
  });
}

export async function createManagerTask(input: CreateManagerTaskInput) {
  await assertManagerActor(input.managerId);

  const isManaged = await isManagerOfUser(input.managerId, input.targetUserId);
  if (!isManaged) {
    throw new ServiceError(403, "Manager can only create tasks for own team");
  }

  const list = await db.query.todoLists.findFirst({
    where: and(eq(todoLists.id, input.listId), eq(todoLists.userId, input.targetUserId)),
    columns: { id: true },
  });

  if (!list) {
    throw new ServiceError(400, "List does not exist for selected user");
  }

  if (input.categoryId) {
    const category = await db.query.categories.findFirst({
      where: and(
        eq(categories.id, input.categoryId),
        eq(categories.userId, input.targetUserId),
      ),
      columns: { id: true },
    });

    if (!category) {
      throw new ServiceError(400, "Category does not exist for selected user");
    }
  }

  const [createdTask] = await db
    .insert(tasks)
    .values({
      userId: input.targetUserId,
      createdByUserId: input.managerId,
      listId: input.listId,
      categoryId: input.categoryId,
      title: input.title,
      description: input.description,
      priority: input.priority,
      status: input.status,
      dueDate: input.dueDate,
      completedAt: input.completedAt,
      estimatedMinutes: input.estimatedMinutes,
    })
    .returning();

  return createdTask;
}

export async function updateTaskStatus(input: UpdateTaskStatusInput) {
  const existingTask = await db.query.tasks.findFirst({
    where: eq(tasks.id, input.taskId),
    columns: {
      id: true,
      userId: true,
      createdByUserId: true,
    },
  });

  if (!existingTask) {
    throw new ServiceError(404, "Task not found");
  }

  const canAccess = await canActorAccessUser(input.actor, existingTask.userId);
  if (!canAccess) {
    throw new ServiceError(403, "Forbidden");
  }

  if (input.actor.role === "user" && input.actor.id !== existingTask.userId) {
    throw new ServiceError(403, "Forbidden");
  }

  const [updatedTask] = await db
    .update(tasks)
    .set({
      status: input.status,
      completedAt:
        input.completedAt !== undefined
          ? input.completedAt
          : input.status === "done"
            ? new Date()
            : null,
    })
    .where(eq(tasks.id, input.taskId))
    .returning();

  if (!updatedTask) {
    throw new ServiceError(404, "Task not found");
  }

  return updatedTask;
}

export async function deleteTask(input: DeleteTaskInput) {
  const existingTask = await db.query.tasks.findFirst({
    where: eq(tasks.id, input.taskId),
    columns: {
      id: true,
      userId: true,
      createdByUserId: true,
    },
  });

  if (!existingTask) {
    throw new ServiceError(404, "Task not found");
  }

  const canAccess = await canActorAccessUser(input.actor, existingTask.userId);
  if (!canAccess) {
    throw new ServiceError(403, "Forbidden");
  }

  if (input.actor.role === "user") {
    if (input.actor.id !== existingTask.userId) {
      throw new ServiceError(403, "Forbidden");
    }

    if (existingTask.createdByUserId !== input.actor.id) {
      throw new ServiceError(403, "User cannot delete manager-created task");
    }
  }

  const [deletedTask] = await db
    .delete(tasks)
    .where(eq(tasks.id, input.taskId))
    .returning({ id: tasks.id });

  if (!deletedTask) {
    throw new ServiceError(404, "Task not found");
  }

  return deletedTask;
}
