import { graphReader } from "./staff";
import { problem } from "./problem";

/** Who may read setup results: the consultant, the tenant's Client Admin and its Executives (the roles the setup read policy allows). */
export async function setupReader(req: Request, engagementId: string) {
  const g = await graphReader(req, engagementId);
  if (g instanceof Response) return g;
  return g.role === "SUPER_ADMIN" ? problem({ code: "FORBIDDEN", status: 403, title: "Your role or scope does not permit this." }) : g;
}
