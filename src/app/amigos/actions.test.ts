import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  requireAuthenticatedUser: vi.fn(),
  createClient: vi.fn(),
  updateConnectionStatus: vi.fn(),
  deleteConnection: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock("@/lib/auth/require-authenticated-user", () => ({
  requireAuthenticatedUser: mocks.requireAuthenticatedUser,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: mocks.createClient,
}));

vi.mock("@/infrastructure/supabase/social/social-repository", () => ({
  SupabaseSocialRepository: vi.fn(function () {
    return {
      updateConnectionStatus: mocks.updateConnectionStatus,
      deleteConnection: mocks.deleteConnection,
    };
  }),
}));

import {
  acceptFriendRequestAction,
  cancelFriendRequestAction,
  declineFriendRequestAction,
  removeFriendConnectionAction,
} from "./actions";

function connectionFormData(connectionId = "connection-1") {
  const formData = new FormData();
  formData.set("connectionId", connectionId);
  return formData;
}

describe("friend connection actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAuthenticatedUser.mockResolvedValue({ sub: "user-1" });
    mocks.createClient.mockResolvedValue({ client: true });
    mocks.updateConnectionStatus.mockImplementation(async () => undefined);
    mocks.deleteConnection.mockImplementation(async () => undefined);
  });

  it("accepts a pending request as the authenticated recipient", async () => {
    await acceptFriendRequestAction(connectionFormData());

    expect(mocks.updateConnectionStatus).toHaveBeenCalledWith(
      "user-1",
      "connection-1",
      "accepted",
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/amigos");
  });

  it.each([
    ["declines a received request", declineFriendRequestAction],
    ["cancels an outgoing request", cancelFriendRequestAction],
    ["removes an accepted connection", removeFriendConnectionAction],
  ])("%s through the participant delete boundary", async (_, action) => {
    await action(connectionFormData());

    expect(mocks.deleteConnection).toHaveBeenCalledWith(
      "user-1",
      "connection-1",
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/amigos");
  });

  it("rejects an empty connection identifier before mutation", async () => {
    await expect(
      acceptFriendRequestAction(connectionFormData("  ")),
    ).rejects.toThrow("A conexão social é obrigatória.");

    expect(mocks.requireAuthenticatedUser).not.toHaveBeenCalled();
    expect(mocks.updateConnectionStatus).not.toHaveBeenCalled();
  });
});
