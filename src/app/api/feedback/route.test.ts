import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createFeedback: vi.fn(),
  consume: vi.fn(),
  createClient: vi.fn(),
  captureServerEvent: vi.fn(),
}));

vi.mock("@/lib/analytics/posthog-server", () => ({
  captureServerEvent: mocks.captureServerEvent,
}));

vi.mock("@/infrastructure/supabase/feedback-repository", () => ({
  createFeedback: mocks.createFeedback,
  FeedbackAuthenticationError: class FeedbackAuthenticationError extends Error {},
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: mocks.createClient,
}));

vi.mock(
  "@/infrastructure/supabase/security/api-rate-limit-repository",
  () => ({
    SupabaseApiRateLimitRepository: class {
      consume = mocks.consume;
    },
  }),
);

import { FeedbackAuthenticationError } from "@/infrastructure/supabase/feedback-repository";
import { POST } from "./route";

function feedbackRequest(body: unknown) {
  return new Request("https://example.com/api/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const validInput = {
  name: "",
  email: "student@example.com",
  feedback: "Gostei do Santuário.",
};

const savedFeedback = {
  id: "feedback-1",
  userId: "user-123",
  createdAt: "2026-10-11T10:00:00.000Z",
};

describe("POST /api/feedback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createClient.mockResolvedValue({ from: vi.fn() });
    mocks.consume.mockResolvedValue({
      allowed: true,
      remaining: 9,
      retryAfterSeconds: 0,
    });
    mocks.createFeedback.mockResolvedValue(savedFeedback);
  });

  it("persists valid feedback when the quota allows it, without caching", async () => {
    const response = await POST(feedbackRequest(validInput));

    expect(response.status).toBe(201);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      id: savedFeedback.id,
      createdAt: savedFeedback.createdAt,
    });
    expect(mocks.consume).toHaveBeenCalledWith("feedback");
    expect(mocks.createFeedback).toHaveBeenCalledWith({
      name: null,
      email: validInput.email,
      feedback: validInput.feedback,
    });
  });

  it("records feedback_submitted for the author without the email or text", async () => {
    await POST(feedbackRequest(validInput));

    expect(mocks.captureServerEvent).toHaveBeenCalledWith(
      "user-123",
      "feedback_submitted",
      { feedback_length: validInput.feedback.length },
    );
    expect(JSON.stringify(mocks.captureServerEvent.mock.calls)).not.toContain(
      validInput.email,
    );
  });

  it("returns 429 with Retry-After and stores nothing once the quota is exhausted", async () => {
    mocks.consume.mockResolvedValue({
      allowed: false,
      remaining: 0,
      retryAfterSeconds: 30,
    });

    const response = await POST(feedbackRequest(validInput));

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("30");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(mocks.createFeedback).not.toHaveBeenCalled();
  });

  it("stays fail-open when the limiter is unavailable", async () => {
    mocks.consume.mockRejectedValue(new Error("relation does not exist"));

    const response = await POST(feedbackRequest(validInput));

    expect(response.status).toBe(201);
    expect(mocks.createFeedback).toHaveBeenCalledTimes(1);
  });

  it("rejects invalid input without consuming quota or persisting it", async () => {
    const response = await POST(feedbackRequest({
      name: "",
      email: "invalid-email",
      feedback: "",
    }));

    expect(response.status).toBe(400);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      error: "Revise os campos do formulário.",
    });
    expect(mocks.consume).not.toHaveBeenCalled();
    expect(mocks.createFeedback).not.toHaveBeenCalled();
  });

  it("treats malformed JSON as a client input error without consuming quota", async () => {
    const request = new Request("https://example.com/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: '{"name":',
    });
    const response = await POST(request);

    expect(response.status).toBe(400);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      error: "Revise os campos do formulário.",
    });
    expect(mocks.consume).not.toHaveBeenCalled();
    expect(mocks.createFeedback).not.toHaveBeenCalled();
  });

  it("keeps a server-side SyntaxError classified as an internal failure", async () => {
    mocks.createFeedback.mockRejectedValueOnce(
      new SyntaxError("internal parser detail must remain private"),
    );

    const response = await POST(feedbackRequest(validInput));

    expect(response.status).toBe(500);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      error: "Não foi possível salvar o feedback.",
    });
  });

  it("returns 401 only for a typed authentication failure", async () => {
    mocks.createFeedback.mockRejectedValueOnce(new FeedbackAuthenticationError());

    const response = await POST(feedbackRequest(validInput));

    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(mocks.captureServerEvent).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({
      error: "Entre na sua conta para enviar feedback.",
    });
  });

  it("does not disclose internal exception details to clients", async () => {
    mocks.createFeedback.mockRejectedValueOnce(
      new Error("internal database host=db.private.example credential=secret"),
    );

    const response = await POST(feedbackRequest(validInput));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(body).toEqual({ error: "Não foi possível salvar o feedback." });
    expect(JSON.stringify(body)).not.toContain("db.private.example");
    expect(JSON.stringify(body)).not.toContain("secret");
  });
});
