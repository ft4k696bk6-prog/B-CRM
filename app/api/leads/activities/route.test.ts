import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClient, getUser, single } = vi.hoisted(() => ({
  createClient: vi.fn(),
  getUser: vi.fn(),
  single: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({ createClient }));

import { POST } from "@/app/api/leads/activities/route";

describe("lead activity authentication", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";

    const query = {
      insert: vi.fn(),
      select: vi.fn(),
      single,
    };
    query.insert.mockReturnValue(query);
    query.select.mockReturnValue(query);
    single.mockResolvedValue({
      data: { id: "activity", description: "Testowa notatka" },
      error: null,
    });
    getUser.mockResolvedValue({ data: { user: { id: "user-id" } } });
    createClient.mockReturnValue({ auth: { getUser }, from: vi.fn(() => query) });
  });

  it("validates the bearer token instead of looking for a missing server session", async () => {
    const response = await POST(new Request("https://crm.test/api/leads/activities", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer current-access-token",
      },
      body: JSON.stringify({
        lead_id: "123e4567-e89b-42d3-a456-426614174000",
        activity_type: "comment",
        title: "Komentarz",
        description: "Testowa notatka",
      }),
    }));

    expect(response.status).toBe(200);
    expect(getUser).toHaveBeenCalledWith("current-access-token");
  });
});
