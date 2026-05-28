"use client";

import { useEffect, useState } from "react";
import { apiFetch, apiUrl } from "../../lib/api";

type Project = {
  id: string;
  name: string;
  slug: string;
  repoOwner: string;
  repoName: string;
  branch: string;
  buildMethod: string;
  appPort: number;
  status: string;
  url: string;
};

type MeResponse = { user: null | { username: string; avatarUrl?: string } };
type ProjectsResponse = { projects: Project[] };

export default function DashboardPage() {
  const [me, setMe] = useState<MeResponse["user"]>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const profile = await apiFetch<MeResponse>("/auth/me");
        if (!profile.user) {
          window.location.href = `${apiUrl}/auth/github`;
          return;
        }
        const projectPayload = await apiFetch<ProjectsResponse>("/api/projects");
        if (active) {
          setMe(profile.user);
          setProjects(projectPayload.projects);
        }
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Failed to load dashboard");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, []);

  async function logout() {
    await apiFetch("/auth/logout", { method: "POST" });
    window.location.href = "/";
  }

  return (
    <main className="shell">
      <nav className="nav">
        <a className="logo" href="/"><span className="logo-mark" />Cadsploy</a>
        <div className="nav-links">
          <a className="btn primary" href="/projects/new">New Project</a>
          <button className="btn" onClick={logout}>Logout</button>
        </div>
      </nav>

      <div className="header-row">
        <div>
          <h1 className="title">Deployments</h1>
          <p className="muted">{me ? `Signed in as ${me.username}` : "Loading operator profile..."}</p>
        </div>
      </div>

      {loading ? <p className="muted">Loading projects…</p> : null}
      {error ? <p className="error">{error}</p> : null}

      {!loading && projects.length === 0 ? (
        <section className="panel">
          <h2>No project yet</h2>
          <p className="muted">Import a GitHub repository and Cadsploy will turn it into a running container.</p>
          <a className="btn primary" href="/projects/new">Create first project</a>
        </section>
      ) : null}

      {projects.length > 0 ? (
        <section className="panel">
          <table className="table">
            <thead>
              <tr><th>Project</th><th>Repo</th><th>Runtime</th><th>Status</th></tr>
            </thead>
            <tbody>
              {projects.map((project) => (
                <tr key={project.id}>
                  <td><a href={`/projects/${project.id}`}>{project.name}</a><br /><span className="muted">{project.url}</span></td>
                  <td>{project.repoOwner}/{project.repoName}<br /><span className="muted">{project.branch}</span></td>
                  <td>{project.buildMethod} :{project.appPort}</td>
                  <td><span className="status">{project.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}
    </main>
  );
}
