import { z } from "zod";

const openApiRoleValues = ["user", "manager", "admin"] as const;
const openApiThemeValues = ["system", "light", "dark"] as const;
const openApiDensityValues = ["compact", "comfortable"] as const;
const openApiTaskPriorityValues = ["low", "medium", "high"] as const;
const openApiTaskStatusValues = ["not_started", "in_progress", "done"] as const;

const isoDateTime = z.string().describe("ISO 8601 datum i vreme");

export const OpenApiPaginationMetaSchema = z.object({
  page: z.number().int().min(1),
  limit: z.number().int().min(1),
  total: z.number().int().min(0),
  totalPages: z.number().int().min(1),
});

export const OpenApiErrorResponseSchema = z.object({
  error: z.object({
    message: z.string(),
    details: z.unknown().optional(),
  }),
});

export const OpenApiCategorySchema = z.object({
  id: z.string().uuid(),
  userId: z.string(),
  createdByUserId: z.string(),
  name: z.string(),
  color: z.string(),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
});

export const OpenApiListSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  description: z.string().nullable(),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
});

export const OpenApiTaskSchema = z.object({
  id: z.string().uuid(),
  userId: z.string(),
  createdByUserId: z.string(),
  listId: z.string().uuid(),
  categoryId: z.string().uuid().nullable(),
  title: z.string(),
  description: z.string().nullable(),
  priority: z.enum(openApiTaskPriorityValues),
  status: z.enum(openApiTaskStatusValues),
  dueDate: isoDateTime.nullable(),
  completedAt: isoDateTime.nullable(),
  estimatedMinutes: z.number().int(),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
});

export const OpenApiEventSchema = z.object({
  id: z.string().uuid(),
  userId: z.string(),
  createdByUserId: z.string(),
  taskId: z.string().uuid().nullable(),
  title: z.string(),
  description: z.string().nullable(),
  startsAt: isoDateTime,
  endsAt: isoDateTime,
  location: z.string().nullable(),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
});

export const OpenApiNoteSchema = z.object({
  id: z.string().uuid(),
  userId: z.string(),
  createdByUserId: z.string(),
  categoryId: z.string().uuid().nullable(),
  title: z.string(),
  content: z.string(),
  pinned: z.boolean(),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
});

export const OpenApiReminderSchema = z.object({
  id: z.string().uuid(),
  userId: z.string(),
  createdByUserId: z.string(),
  taskId: z.string().uuid().nullable(),
  eventId: z.string().uuid().nullable(),
  message: z.string(),
  remindAt: isoDateTime,
  isSent: z.boolean(),
  sentAt: isoDateTime.nullable(),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
});

export const OpenApiProfileSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  role: z.enum(openApiRoleValues),
  isActive: z.boolean(),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
});

export const OpenApiPreferencesSchema = z.object({
  id: z.string().uuid(),
  userId: z.string(),
  theme: z.enum(openApiThemeValues),
  language: z.string(),
  layoutDensity: z.enum(openApiDensityValues),
  timezone: z.string(),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
});

export const OpenApiAdminUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  role: z.enum(openApiRoleValues),
  managerId: z.string().nullable(),
  isActive: z.boolean(),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
  managerName: z.string().nullable(),
  teamSize: z.number().int(),
});

export const OpenApiDeletedAdminUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  role: z.enum(openApiRoleValues),
  managerId: z.string().nullable(),
  isActive: z.boolean(),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
});

export const OpenApiEntityIdSchema = z.object({
  id: z.string(),
});

export const OpenApiCategoriesListResponseSchema = z.object({
  data: z.array(OpenApiCategorySchema),
});

export const OpenApiCategoryResponseSchema = z.object({
  data: OpenApiCategorySchema,
});

export const OpenApiListsListResponseSchema = z.object({
  data: z.array(OpenApiListSchema),
});

export const OpenApiListResponseSchema = z.object({
  data: OpenApiListSchema,
});

export const OpenApiTasksListResponseSchema = z.object({
  data: z.array(OpenApiTaskSchema),
  meta: OpenApiPaginationMetaSchema,
});

export const OpenApiTaskResponseSchema = z.object({
  data: OpenApiTaskSchema,
});

export const OpenApiEventsListResponseSchema = z.object({
  data: z.array(OpenApiEventSchema),
  meta: OpenApiPaginationMetaSchema,
});

export const OpenApiEventResponseSchema = z.object({
  data: OpenApiEventSchema,
});

export const OpenApiNotesListResponseSchema = z.object({
  data: z.array(OpenApiNoteSchema),
  meta: OpenApiPaginationMetaSchema,
});

export const OpenApiNoteResponseSchema = z.object({
  data: OpenApiNoteSchema,
});

export const OpenApiRemindersListResponseSchema = z.object({
  data: z.array(OpenApiReminderSchema),
  meta: OpenApiPaginationMetaSchema,
});

export const OpenApiReminderResponseSchema = z.object({
  data: OpenApiReminderSchema,
});

export const OpenApiProfileResponseSchema = z.object({
  data: OpenApiProfileSchema,
});

export const OpenApiPreferencesResponseSchema = z.object({
  data: OpenApiPreferencesSchema,
});

export const OpenApiAdminUsersListResponseSchema = z.object({
  data: z.array(OpenApiAdminUserSchema),
});

export const OpenApiAdminUserResponseSchema = z.object({
  data: OpenApiAdminUserSchema,
});

export const OpenApiDeletedAdminUserResponseSchema = z.object({
  data: OpenApiDeletedAdminUserSchema,
});

export const OpenApiEntityIdResponseSchema = z.object({
  data: OpenApiEntityIdSchema,
});
