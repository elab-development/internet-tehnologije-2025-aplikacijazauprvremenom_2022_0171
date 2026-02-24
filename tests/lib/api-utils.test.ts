import { NextRequest } from "next/server";
import { vi } from "vitest";

const { findFirstMock, getSessionMock } = vi.hoisted(() => ({
  findFirstMock: vi.fn(),
  getSessionMock: vi.fn(),
}));

vi.mock("@/db", () => ({
  db: {
    query: {
      user: {
        findFirst: findFirstMock,
      },
    },
  },
}));

vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: getSessionMock,
    },
  },
}));

import {
  canActorAccessUser,
  isLockedForUser,
  requireActor,
  requireAdmin,
  resolveTargetUserId,
  type SessionActor,
} from "@/lib/api-utils";

function requestWithHeaders(headers?: HeadersInit) {
  return new NextRequest("http://localhost:3000/api/test", { headers });
}

describe("lib/api-utils RBAC helperi", () => {
  const regularActor: SessionActor = {
    id: "user-1",
    role: "user",
    isActive: true,
    managerId: null,
  };

  const managerActor: SessionActor = {
    id: "manager-1",
    role: "manager",
    isActive: true,
    managerId: null,
  };

  const adminActor: SessionActor = {
    id: "admin-1",
    role: "admin",
    isActive: true,
    managerId: null,
  };

  beforeEach(() => {
    findFirstMock.mockReset();
    getSessionMock.mockReset();
  });

  it("canActorAccessUser dozvoljava pristup sopstvenom korisniku", async () => {
    await expect(canActorAccessUser(regularActor, "user-1")).resolves.toBe(true);
  });

  it("canActorAccessUser dozvoljava adminu pristup svim korisnicima", async () => {
    await expect(canActorAccessUser(adminActor, "user-99")).resolves.toBe(true);
  });

  it("canActorAccessUser odbija obicnog korisnika za tudji nalog", async () => {
    await expect(canActorAccessUser(regularActor, "user-2")).resolves.toBe(false);
  });

  it("canActorAccessUser koristi proveru menadzera nad timom", async () => {
    findFirstMock.mockResolvedValueOnce({ id: "user-2" });

    await expect(canActorAccessUser(managerActor, "user-2")).resolves.toBe(true);

    findFirstMock.mockResolvedValueOnce(null);
    await expect(canActorAccessUser(managerActor, "user-3")).resolves.toBe(false);
  });

  it("resolveTargetUserId vraca actor.id kada target nije prosledjen", async () => {
    const result = await resolveTargetUserId(regularActor, undefined);

    expect(result).toEqual({ ok: true, targetUserId: "user-1" });
  });

  it("resolveTargetUserId vraca 403 za nedozvoljen target", async () => {
    const result = await resolveTargetUserId(regularActor, "user-2");
    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.response.status).toBe(403);
      const payload = await result.response.json();
      expect(payload.error.message).toContain("Nemate dozvolu");
    }
  });

  it("isLockedForUser zakljucava user-a za entitet koji nije sam kreirao", () => {
    expect(
      isLockedForUser(
        { id: "user-1", role: "user", isActive: true, managerId: null },
        "user-1",
        "manager-1",
      ),
    ).toBe(true);

    expect(
      isLockedForUser(
        { id: "user-1", role: "user", isActive: true, managerId: null },
        "user-1",
        "user-1",
      ),
    ).toBe(false);
  });
});

describe("lib/api-utils auth guardovi", () => {
  beforeEach(() => {
    findFirstMock.mockReset();
    getSessionMock.mockReset();
  });

  it("requireActor vraca 401 kada ne postoji sesija", async () => {
    getSessionMock.mockResolvedValueOnce(null);

    const result = await requireActor(requestWithHeaders());
    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.response.status).toBe(401);
      const payload = await result.response.json();
      expect(payload.error.message).toContain("Neautorizovan");
    }
  });

  it("requireActor vraca 403 kada je nalog deaktiviran", async () => {
    getSessionMock.mockResolvedValueOnce({ user: { id: "user-1" } });
    findFirstMock.mockResolvedValueOnce({
      id: "user-1",
      role: "user",
      isActive: false,
      managerId: null,
    });

    const result = await requireActor(requestWithHeaders());
    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.response.status).toBe(403);
      const payload = await result.response.json();
      expect(payload.error.message).toContain("deaktiviran");
    }
  });

  it("requireAdmin dozvoljava samo admin korisniku", async () => {
    getSessionMock.mockResolvedValueOnce({ user: { id: "manager-1" } });
    findFirstMock.mockResolvedValueOnce({
      id: "manager-1",
      role: "manager",
      isActive: true,
      managerId: null,
    });

    const managerResult = await requireAdmin(requestWithHeaders());
    expect(managerResult.ok).toBe(false);

    getSessionMock.mockResolvedValueOnce({ user: { id: "admin-1" } });
    findFirstMock.mockResolvedValueOnce({
      id: "admin-1",
      role: "admin",
      isActive: true,
      managerId: null,
    });

    const adminResult = await requireAdmin(requestWithHeaders());
    expect(adminResult).toEqual({ ok: true, adminId: "admin-1" });
  });
});
