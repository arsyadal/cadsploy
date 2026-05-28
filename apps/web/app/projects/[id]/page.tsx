"use client";

import { FormEvent, useEffect, useState } from "react";
import { apiFetch } from "../../../lib/api";

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

type Deployment = {
  id: string;
  status: string;
  commitSha?: string;
  errorMessage?: string;
  createdAt: string;
};

type ProjectPayload = { project: Project; deployments: Deployment[] };
type LogsPayload = { logs: Array<{ id: string; line: string; stream: string; createdAt: string }> };
type RuntimeLogsPayload = { logs: string };
type EnvPayload = { env: Array<{ id: string; key: string; scope: string; masked: string }> };

export default function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const [projectId, setProjectId] = useState("");
  const [project, setProject] = useState<Project | null>(null);
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [logs, setLogs] = useState("");
  const [runtimeLogs, setRuntimeLogs] = useState("");
  const [env, setEnv] = useState<EnvPayload["env"]>([]);
  const [envKey, setEnvKey] = useState("");
  const [envValue, setEnvValue] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    params.then((value) => setProjectId(value.id));
  }, [params]);

  async function load(id = projectId) {
    if (!id) return;
    try {
      const payload = await apiFetch<ProjectPayload>(`/api/projects/${id}`);
      setProject(payload.project);
      setDeployments(payload.deployments);
      const latest = payload.deployments[0];
      if (latest) {
        const logPayload = await apiFetch<LogsPayload>(`/api/deployments/${latest.id}/logs`);
        setLogs(logPayload.logs.map((item) => `[${item.stream}] ${item.line}`).join("\n"));
      }
      const envPayload = await apiFetch<EnvPayload>(`/api/projects/${id}/env`);
      setEnv(envPayload.env);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load project");
    }
  }

  useEffect(() => { void load(); }, [projectId]);

  async function deploy() {
    if (!projectId) return;
    setError("");
    await apiFetch(`/api/projects/${projectId}/deployments`, { method: "POST" });
    await load();
  }

  async function refreshRuntimeLogs() {
    if (!projectId) return;
    const payload = await apiFetch<RuntimeLogsPayload>(`/api/projects/${projectId}/runtime-logs`);
    setRuntimeLogs(payload.logs);
  }

  async function restartLatest() {
    const latest = deployments.find((item) => item.status === "running") ?? deployments[0];
    if (!latest) return;
    await apiFetch(`/api/deployments/${latest.id}/restart`, { method: "POST" });
    await refreshRuntimeLogs();
  }

  async function saveEnv(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!projectId) return;
    await apiFetch(`/api/projects/${projectId}/env`, {
      method: "POST",
      body: JSON.stringify({ key: envKey, value: envValue, scope: "both" }),
    });
    setEnvKey("");
    setEnvValue("");
    await load();
  }

  async function deleteProject() {
    if (!projectId || !confirm("Delete this project? Container cleanup is handled by runtime ops.")) return;
    await apiFetch(`/api/projects/${projectId}`, { method: "DELETE" });
    window.location.href = "/dashboard";
  }

  return (
    <main className="shell">
      <nav className="nav">
        <a className="logo" href="/"><span className="logo-mark" />Cadsploy</a>
        <div className="nav-links"><a className="btn" href="/dashboard">Dashboard</a></div>
      </nav>

      {project ? (
        <>
          <div className="header-row">
            <div>
              <h1 className="title">{project.name}</h1>
              <p className="muted">{project.repoOwner}/{project.repoName} · {project.branch} · {project.buildMethod}:{project.appPort}</p>
              <a href={project.url} target="_blank" rel="noreferrer">{project.url}</a>
            </div>
            <div className="actions">
              <button className="btn primary" onClick={deploy}>Deploy</button>
              <button className="btn" onClick={restartLatest}>Restart</button>
              <button className="btn" onClick={() => load()}>Refresh</button>
              <button className="btn danger" onClick={deleteProject}>Delete</button>
            </div>
          </div>

          {error ? <p className="error">{error}</p> : null}

          <div className="two-col">
            <section className="panel">
              <h2>Deployments</h2>
              <table className="table">
                <tbody>
                  {deployments.map((item) => (
                    <tr key={item.id}>
                      <td><span className="status">{item.status}</span></td>
                      <td>{new Date(item.createdAt).toLocaleString()}<br /><span className="muted">{item.commitSha?.slice(0, 7) ?? "no commit yet"}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section className="panel">
              <h2>Environment</h2>
              <form className="form" onSubmit={saveEnv}>
                <div className="field"><label>Key</label><input value={envKey} onChange={(event) => setEnvKey(event.target.value.toUpperCase())} placeholder="APP_SECRET" /></div>
                <div className="field"><label>Value</label><input value={envValue} onChange={(event) => setEnvValue(event.target.value)} placeholder="••••" /></div>
                <button className="btn primary">Save env</button>
              </form>
              <p className="muted">{env.map((item) => item.key).join(", ") || "No env vars"}</p>
            </section>
          </div>

          <section className="panel" style={{ marginTop: 18 }}>
            <h2>Build logs</h2>
            <pre className="log">{logs || "No build logs yet."}</pre>
          </section>

          <section className="panel" style={{ marginTop: 18 }}>
            <div className="header-row"><h2>Runtime logs</h2><button className="btn" onClick={refreshRuntimeLogs}>Load runtime logs</button></div>
            <pre className="log">{runtimeLogs || "Runtime logs not loaded."}</pre>
          </section>
        </>
      ) : <p className="muted">Loading project…</p>}
    </main>
  );
}
