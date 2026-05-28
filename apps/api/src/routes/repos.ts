import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireUser } from "../auth.js";
import { decryptText } from "../crypto.js";

const repoSchema = z.object({
  id: z.number(),
  name: z.string(),
  full_name: z.string(),
  private: z.boolean(),
  clone_url: z.string(),
  default_branch: z.string(),
  owner: z.object({ login: z.string() }),
});

const branchSchema = z.object({ name: z.string() });

async function githubFetch<T>(path: string, token: string, schema: z.ZodType<T>) {
  const response = await fetch(`https://api.github.com${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "Cadsploy",
    },
  });

  if (!response.ok) throw new Error(`GitHub API failed: ${response.status}`);
  return schema.parse(await response.json());
}

export async function repoRoutes(app: FastifyInstance) {
  app.get("/api/repos", async (request) => {
    const user = await requireUser(request);
    const token = decryptText(user.githubAccessTokenEncrypted);
    const repos = await githubFetch("/user/repos?per_page=100&sort=updated", token, z.array(repoSchema));

    return {
      repos: repos.map((repo) => ({
        id: repo.id,
        name: repo.name,
        fullName: repo.full_name,
        owner: repo.owner.login,
        private: repo.private,
        cloneUrl: repo.clone_url,
        defaultBranch: repo.default_branch,
      })),
    };
  });

  app.get("/api/repos/:owner/:repo/branches", async (request) => {
    await requireUser(request);
    const params = z.object({ owner: z.string().min(1), repo: z.string().min(1) }).parse(request.params);
    const user = await requireUser(request);
    const token = decryptText(user.githubAccessTokenEncrypted);
    const branches = await githubFetch(`/repos/${encodeURIComponent(params.owner)}/${encodeURIComponent(params.repo)}/branches?per_page=100`, token, z.array(branchSchema));
    return { branches: branches.map((branch) => branch.name) };
  });
}
