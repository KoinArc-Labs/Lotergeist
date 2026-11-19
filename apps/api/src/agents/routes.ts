import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { audit, HttpError, type Actor, type Ctx } from "../core";
import "./coroner";
import "./rx";
import "./outreach";
import "./nightwatch";
import "./stock";
import "./copilot";
import { ADVISORY_LABEL, allAgents, canRun, getAgent, listRuns, runAgent, sampleFor } from "./agent";
import { draftQueue } from "./outreach";
import { PROVIDER_IDS, runtimeOf } from "./providers";

/** Who may change the provider: the pharmacist (in charge of the store) and the admin. */
const CONFIGURE = ["pharmacist", "admin"] as const;

const providerBody = z.object({
  provider: z.enum(PROVIDER_IDS as [string, ...string[]]).optional(),
  model: z.string().trim().max(120).optional(),
  region: z.string().trim().regex(/^[a-z]{2}(-[a-z]+)+-\d$/, "region looks like us-west-2").optional(),
  baseUrl: z.string().trim().max(200).optional(),
  apiKey: z.string().max(600).optional()
}).strict();

/** The OpenAI-compatible base URL is called from the server, so keep it to plain http(s) with no embedded credentials and no link-local range. */
function checkBaseUrl(raw: string) {
  let u: URL;
  try { u = new URL(raw); } catch { throw new HttpError(422, "The base URL is not a valid URL.", "base_url"); }
  if (!/^https?:$/.test(u.protocol)) throw new HttpError(422, "The base URL must start with http:// or https://.", "base_url");
  if (u.username || u.password) throw new HttpError(422, "Put the key in the key field, not in the URL.", "base_url");
  if (/^169\.254\./.test(u.hostname) || /metadata/i.test(u.hostname)) throw new HttpError(422, "That address is not allowed.", "base_url");
}

export function registerAgentRoutes(app: FastifyInstance, ctx: Ctx) {
  const A = (req: FastifyRequest): Actor => req.actor!;
  const need = (req: FastifyRequest, roles: readonly Actor["role"][]) => {
    if (!roles.includes(A(req).role)) throw new HttpError(403, `A ${A(req).role} cannot do that.`, "forbidden");
  };
  const rt = () => runtimeOf(ctx);

  app.get("/api/agents", async (req) => {
    const role = A(req).role;
    return {
      label: ADVISORY_LABEL,
      provider: rt().settings(),
      canConfigure: (CONFIGURE as readonly string[]).includes(role),
      agents: allAgents().map((a) => ({ id: a.id, name: a.name, purpose: a.purpose, guardrails: a.guardrails, roles: a.roles, canRun: canRun(a, role), readOnly: true }))
    };
  });

  app.get("/api/agents/provider", async () => ({ provider: rt().settings() }));

  app.post("/api/agents/provider", async (req) => {
    need(req, CONFIGURE);
    const b = providerBody.parse(req.body);
    if (b.baseUrl) checkBaseUrl(b.baseUrl);
    const before = rt().settings();
    const r = rt().update(b as any);
    const after = rt().settings();
    // The audit row records what changed. The key is never part of it, only whether one was set.
    audit(ctx, A(req), "agents.provider.update", "agents", "provider", { provider: before.provider, model: before.model }, { provider: after.provider, model: after.model, region: after.region, baseUrl: after.baseUrl, keyChanged: r.keyChanged, keyHint: after.keyHint });
    return { provider: after };
  });

  app.post("/api/agents/provider/test", async (req) => {
    need(req, CONFIGURE);
    const r = await rt().test();
    audit(ctx, A(req), "agents.provider.test", "agents", "provider", undefined, { ok: r.ok, provider: r.provider, model: r.model });
    return r;
  });

  app.get("/api/agents/runs", async (req) => {
    const q = z.object({ agent: z.string().max(40).optional(), limit: z.coerce.number().int().min(1).max(100).optional() }).parse(req.query);
    return { label: ADVISORY_LABEL, runs: listRuns(ctx, q.agent, q.limit ?? 25) };
  });

  app.get("/api/agents/drafts", async (req) => {
    need(req, ["pharmacist"]);
    const q = z.object({ recallId: z.string().max(40).optional() }).parse(req.query);
    return { note: "Drafts only. Nothing here has been sent. Sending needs a pharmacist's attestation on the Recalls screen.", drafts: draftQueue(ctx, q.recallId) };
  });

  app.get("/api/agents/:id", async (req) => {
    const { id } = z.object({ id: z.string().max(40) }).parse(req.params);
    const a = getAgent(id);
    if (!a) throw new HttpError(404, "Unknown agent.");
    return {
      id: a.id, name: a.name, purpose: a.purpose, guardrails: a.guardrails, roles: a.roles, canRun: canRun(a, A(req).role), readOnly: true,
      sample: canRun(a, A(req).role) ? sampleFor(ctx, a.id) : null, runs: listRuns(ctx, a.id, 5)
    };
  });

  app.post("/api/agents/:id/run", async (req) => {
    const { id } = z.object({ id: z.string().max(40) }).parse(req.params);
    const a = getAgent(id);
    if (!a) throw new HttpError(404, "Unknown agent.");
    need(req, a.roles);
    const body = z.object({ input: z.record(z.unknown()).optional(), useSample: z.boolean().optional() }).parse(req.body ?? {});
    const input = body.useSample || !body.input ? sampleFor(ctx, id) : body.input;
    const run = await runAgent(ctx, A(req), id, input);
    return { label: ADVISORY_LABEL, input, run };
  });
}
