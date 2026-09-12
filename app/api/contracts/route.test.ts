import { beforeEach, describe, expect, it, vi } from "vitest";
const { auth } = vi.hoisted(() => ({ auth: vi.fn() }));
vi.mock("@/lib/server-auth", () => ({ requireApiProfile: auth }));
import { GET, PATCH } from "@/app/api/contracts/route";

function request(body: Record<string, unknown>) {
  return new Request("https://crm.test/api/contracts", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: "contract", expected_version: 0, ...body }) });
}
beforeEach(() => vi.resetAllMocks());

describe("workflow API authorization", () => {
  it.each(["menadzer", "handlowiec", "finance", "viewer"])("rejects %s before any workflow write", async (role) => {
    const rpc = vi.fn();
    auth.mockResolvedValue({ profile: { id: "user", role, crm_environment: "production" }, supabaseAdmin: { rpc } });
    for (const action of ["workflow", "archive", "restore"]) {
      expect((await PATCH(request({ action, field: "verified", value: true, reason: "resigned" })))?.status).toBe(403);
    }
    expect((await PATCH(request({ process_status: "settled" })))?.status).toBe(403);
    expect((await PATCH(request({ installation_at: "2026-09-22T08:00:00Z" })))?.status).toBe(403);
    expect(rpc).not.toHaveBeenCalled();
  });
  it("rejects an invalid appointment without partially saving the checkbox", async () => {
    const rpc = vi.fn();
    auth.mockResolvedValue({ profile: { id: "admin", role: "admin" }, supabaseAdmin: { rpc } });
    expect((await PATCH(request({ action: "workflow", field: "installation_scheduled", value: true })))?.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });
  it("reports concurrent updates as a conflict", async () => {
    const rpc = vi.fn().mockResolvedValue({ error: { code: "40001", message: "Odśwież listę." } });
    auth.mockResolvedValue({ profile: { id: "admin", role: "admin" }, supabaseAdmin: { rpc } });
    expect((await PATCH(request({ action: "restore" })))?.status).toBe(409);
  });
  it("reads beyond database response limits and counts each contract, including shared leads", async () => {
    const records = Array.from({ length: 1205 }, (_, index) => ({
      id: `contract-${index}`, lead_id: "same-lead", created_by: "admin", customer_name: "Test",
      created_at: "2026-09-12T12:00:00Z", signed_at: "2026-09-01T00:00:00Z", submission_status: "submitted",
      gross_amount: 100, workflow: { verified: true, settled: false, archived_at: null, archive_reason: null },
    }));
    const range = vi.fn((from: number, to: number) => Promise.resolve({ data: records.slice(from, to + 1), error: null }));
    const query = { select: vi.fn(), eq: vi.fn(), order: vi.fn(), range };
    query.select.mockReturnValue(query); query.eq.mockReturnValue(query); query.order.mockReturnValue(query);
    auth.mockResolvedValue({ profile: { id: "admin", role: "admin", crm_environment: "production" }, supabaseAdmin: { from: () => query } });
    const response = await GET(new Request("https://crm.test/api/contracts"));
    if (!response) throw new Error("API nie zwróciło odpowiedzi.");
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.contracts).toHaveLength(1205);
    expect(body.stats[0]).toMatchObject({ signed: 1205, grossAmount: 120500, toInstall: 1205 });
    expect(range).toHaveBeenCalledTimes(3);
  });
});
