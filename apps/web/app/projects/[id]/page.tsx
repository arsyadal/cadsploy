"use client";

import { FormEvent, useEffect, useState } from "react";
import { apiFetch, apiUrl } from "../../../lib/api";

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
  const [projectDomains, setProjectDomains] = useState<Array<{ id: string; hostname: string; type: string; status: string }>>([]);
  const [domainHostname, setDomainHostname] = useState("");
  const [projectDatabases, setProjectDatabases] = useState<Array<{ id: string; name: string; type: string; status: string; containerName: string; dbName?: string; dbUser?: string; dbPassword?: string; port: number; hostPort: number }>>([]);
  const [newDbName, setNewDbName] = useState("");
  const [newDbType, setNewDbType] = useState<"postgres" | "redis">("postgres");
  const [revealPasswords, setRevealPasswords] = useState<Record<string, boolean>>({});
  const [backups, setBackups] = useState<Record<string, Array<{ id: string; fileName: string; fileSize: number | null; status: string; errorMessage: string | null; createdAt: string; completedAt: string | null }>>>({});
  const [volumes, setVolumes] = useState<Array<{ id: string; name: string; containerPath: string }>>([]);
  const [newVolumeName, setNewVolumeName] = useState("");
  const [newVolumePath, setNewVolumePath] = useState("");
  const [stats, setStats] = useState<Array<{ name: string; cpu: string; memoryUsage: string; memoryPerc: string }>>([]);
  const [autoRefreshLogs, setAutoRefreshLogs] = useState(true);
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
      const domainsPayload = await apiFetch<{ domains: typeof projectDomains }>(`/api/projects/${id}/domains`);
      setProjectDomains(domainsPayload.domains);
      const databasesPayload = await apiFetch<{ databases: typeof projectDatabases }>(`/api/projects/${id}/databases`);
      setProjectDatabases(databasesPayload.databases);
      
      for (const db of databasesPayload.databases) {
        const backupsPayload = await apiFetch<{ backups: any[] }>(`/api/projects/${id}/databases/${db.id}/backups`);
        setBackups((prev) => ({
          ...prev,
          [db.id]: backupsPayload.backups
        }));
      }

      const volumesPayload = await apiFetch<{ volumes: typeof volumes }>(`/api/projects/${id}/volumes`);
      setVolumes(volumesPayload.volumes);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load project");
    }
  }

  async function loadStats() {
    if (!projectId) return;
    try {
      const payload = await apiFetch<{ stats: typeof stats }>(`/api/projects/${projectId}/stats`);
      setStats(payload.stats);
    } catch {
      // Silently ignore stats loading errors
    }
  }

  useEffect(() => {
    if (!projectId) return;
    void loadStats();
    const interval = setInterval(() => {
      void loadStats();
    }, 5000);
    return () => clearInterval(interval);
  }, [projectId]);

  useEffect(() => {
    if (!projectId || !autoRefreshLogs) return;
    const interval = setInterval(() => {
      void refreshRuntimeLogs();
    }, 4000);
    return () => clearInterval(interval);
  }, [projectId, autoRefreshLogs]);

  async function addVolume(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!projectId || !newVolumeName.trim() || !newVolumePath.trim()) return;
    setError("");
    try {
      await apiFetch(`/api/projects/${projectId}/volumes`, {
        method: "POST",
        body: JSON.stringify({ name: newVolumeName.trim().toLowerCase(), containerPath: newVolumePath.trim() })
      });
      setNewVolumeName("");
      setNewVolumePath("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add volume");
    }
  }

  async function removeVolume(volumeId: string) {
    if (!projectId || !confirm("Remove this persistent volume? Host directory will be cleaned up, but the app container needs to be redeployed to apply the change.")) return;
    setError("");
    try {
      await apiFetch(`/api/projects/${projectId}/volumes/${volumeId}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete volume");
    }
  }

  async function createBackup(dbId: string) {
    if (!projectId) return;
    setError("");
    try {
      await apiFetch(`/api/projects/${projectId}/databases/${dbId}/backups`, { method: "POST" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create backup");
    }
  }

  async function restoreBackup(dbId: string, backupId: string) {
    if (!projectId || !confirm("Restore this backup? Existing tables and data will be clean-replaced. This operation cannot be undone.")) return;
    setError("");
    try {
      await apiFetch(`/api/projects/${projectId}/databases/${dbId}/backups/${backupId}/restore`, { method: "POST" });
      alert("Database restore job has been scheduled in background.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to restore backup");
    }
  }

  async function deleteBackup(dbId: string, backupId: string) {
    if (!projectId || !confirm("Permanently delete this backup file?")) return;
    setError("");
    try {
      await apiFetch(`/api/projects/${projectId}/databases/${dbId}/backups/${backupId}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete backup");
    }
  }

  function formatSize(bytes: number | null) {
    if (bytes === null || bytes === undefined) return "Calculating…";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  useEffect(() => { void load(); }, [projectId]);

  useEffect(() => {
    const hasActive = deployments.some((dep) => dep.status === "queued" || dep.status === "building");
    if (!hasActive) return;

    const interval = setInterval(() => {
      void load();
    }, 2000);

    return () => clearInterval(interval);
  }, [deployments]);

  async function deploy() {
    if (!projectId) return;
    setError("");
    try {
      await apiFetch(`/api/projects/${projectId}/deployments`, { method: "POST" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to trigger deployment");
    }
  }

  async function refreshRuntimeLogs() {
    if (!projectId) return;
    setError("");
    try {
      const payload = await apiFetch<RuntimeLogsPayload>(`/api/projects/${projectId}/runtime-logs`);
      setRuntimeLogs(payload.logs);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load runtime logs");
    }
  }

  async function restartLatest() {
    const latest = deployments.find((item) => item.status === "running") ?? deployments[0];
    if (!latest) return;
    setError("");
    try {
      await apiFetch(`/api/deployments/${latest.id}/restart`, { method: "POST" });
      await refreshRuntimeLogs();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to restart container");
    }
  }

  async function saveEnv(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!projectId) return;
    setError("");
    try {
      await apiFetch(`/api/projects/${projectId}/env`, {
        method: "POST",
        body: JSON.stringify({ key: envKey, value: envValue, scope: "both" }),
      });
      setEnvKey("");
      setEnvValue("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save env variable");
    }
  }

  async function deleteProject() {
    if (!projectId || !confirm("Delete this project? Container cleanup is handled by runtime ops.")) return;
    setError("");
    try {
      await apiFetch(`/api/projects/${projectId}`, { method: "DELETE" });
      window.location.href = "/dashboard";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete project");
    }
  }

  async function addCustomDomain(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!projectId || !domainHostname.trim()) return;
    setError("");
    try {
      await apiFetch(`/api/projects/${projectId}/domains`, {
        method: "POST",
        body: JSON.stringify({ hostname: domainHostname.trim().toLowerCase() }),
      });
      setDomainHostname("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add domain");
    }
  }

  async function deleteDomain(domainId: string) {
    if (!projectId || !confirm("Remove this domain? Caddy configuration will update automatically.")) return;
    setError("");
    try {
      await apiFetch(`/api/projects/${projectId}/domains/${domainId}`, {
        method: "DELETE",
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete domain");
    }
  }

  async function deployNewDatabase(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!projectId || !newDbName.trim()) return;
    setError("");
    try {
      await apiFetch(`/api/projects/${projectId}/databases`, {
        method: "POST",
        body: JSON.stringify({ name: newDbName.trim().toLowerCase(), type: newDbType }),
      });
      setNewDbName("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to deploy database");
    }
  }

  async function removeDatabase(databaseId: string) {
    if (!projectId || !confirm("Tear down and delete this database instance? All stored data will be permanently lost.")) return;
    setError("");
    try {
      await apiFetch(`/api/projects/${projectId}/databases/${databaseId}`, {
        method: "DELETE",
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete database");
    }
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

          {stats.length > 0 && (
            <section className="panel" style={{ marginTop: 18, border: "1px solid #111" }}>
              <div style={{ display: "flex", gap: 12, overflowX: "auto", padding: "4px 0" }}>
                {stats.map((s) => (
                  <div key={s.name} style={{ flex: "1 1 200px", minWidth: 200, padding: 12, backgroundColor: "#0b0b0b", border: "1px solid #222", borderRadius: 6 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <strong style={{ fontSize: 12, color: "var(--accent)" }}>{s.name}</strong>
                      <span className="status running" style={{ fontSize: 9, padding: "1px 6px" }}>live</span>
                    </div>
                    <div style={{ fontSize: 11, lineHeight: 1.6 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                        <span>CPU Usage:</span>
                        <code>{s.cpu}</code>
                      </div>
                      <div style={{ height: 4, width: "100%", backgroundColor: "#222", borderRadius: 2, marginBottom: 8, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: s.cpu, backgroundColor: "var(--accent)", transition: "width 0.4s ease" }} />
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                        <span>Memory Usage:</span>
                        <code>{s.memoryPerc}</code>
                      </div>
                      <div style={{ height: 4, width: "100%", backgroundColor: "#222", borderRadius: 2, marginBottom: 4, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: s.memoryPerc, backgroundColor: "var(--primary)", transition: "width 0.4s ease" }} />
                      </div>
                      <div style={{ fontSize: 10, color: "#666", textAlign: "right" }}>
                        {s.memoryUsage}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <div className="two-col">
            <section className="panel">
              <h2>Deployments</h2>
              <table className="table">
                <tbody>
                  {deployments.map((item) => (
                    <tr key={item.id}>
                      <td><span className={`status ${item.status}`}>{item.status}</span></td>
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

          <div className="two-col" style={{ marginTop: 18 }}>
            <section className="panel">
              <h2>Add Custom Domain</h2>
              <form className="form" onSubmit={addCustomDomain}>
                <div className="field">
                  <label>Domain Hostname</label>
                  <input
                    value={domainHostname}
                    onChange={(event) => setDomainHostname(event.target.value)}
                    placeholder="my-app.customdomain.com"
                  />
                </div>
                <button className="btn primary">Save Domain</button>
              </form>
            </section>

            <section className="panel">
              <h2>Active Domains</h2>
              <table className="table">
                <thead>
                  <tr>
                    <th>Domain</th>
                    <th>Type</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {projectDomains.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <a href={`http://${item.hostname}:8080`} target="_blank" rel="noreferrer">
                          {item.hostname}
                        </a>
                      </td>
                      <td>
                        <span className={`status ${item.type === "generated" ? "building" : "running"}`}>
                          {item.type}
                        </span>
                      </td>
                      <td>
                        {item.type === "custom" ? (
                          <button className="btn danger" onClick={() => deleteDomain(item.id)}>
                            Delete
                          </button>
                        ) : (
                          <span className="muted">System</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </div>

          <div className="two-col" style={{ marginTop: 18 }}>
            <section className="panel">
              <h2>Deploy Database Service</h2>
              <form className="form" onSubmit={deployNewDatabase}>
                <div className="field">
                  <label>Database Name</label>
                  <input
                    value={newDbName}
                    onChange={(event) => setNewDbName(event.target.value)}
                    placeholder="my-db"
                  />
                </div>
                <div className="field">
                  <label>Database Type</label>
                  <select
                    value={newDbType}
                    onChange={(event) => setNewDbType(event.target.value as "postgres" | "redis")}
                  >
                    <option value="postgres">PostgreSQL 16 (Alpine)</option>
                    <option value="redis">Redis 7 (Alpine)</option>
                  </select>
                </div>
                <button className="btn primary">Deploy Database</button>
              </form>
            </section>

            <section className="panel">
              <h2>Managed Databases</h2>
              <table className="table">
                <thead>
                  <tr>
                    <th>Service / Host Info</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {projectDatabases.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <strong>{item.name}</strong> <span className="muted">({item.type})</span>
                        <div style={{ fontSize: 12, marginTop: 4, lineHeight: 1.4 }}>
                          <div>Internal Host: <code>{item.containerName}:{item.port}</code></div>
                          <div>Host Port (Windows): <code>{item.hostPort}</code></div>
                          {item.type === "postgres" && (
                            <div style={{ marginTop: 4 }}>
                              <div>DB Name: <code>{item.dbName}</code></div>
                              <div>DB User: <code>{item.dbUser}</code></div>
                              <div>
                                DB Password:{" "}
                                <code>
                                  {revealPasswords[item.id] ? item.dbPassword : "••••••••"}
                                </code>{" "}
                                <button
                                  className="btn"
                                  style={{ padding: "2px 6px", fontSize: 10, marginLeft: 4 }}
                                  onClick={() =>
                                    setRevealPasswords((prev) => ({
                                      ...prev,
                                      [item.id]: !prev[item.id]
                                    }))
                                  }
                                >
                                  {revealPasswords[item.id] ? "Hide" : "Reveal"}
                                </button>
                              </div>
                              <div style={{ marginTop: 4, color: "var(--accent)" }}>
                                Connection URL:{" "}
                                <code style={{ fontSize: 10 }}>
                                  {revealPasswords[item.id]
                                    ? `postgresql://${item.dbUser}:${item.dbPassword}@${item.containerName}:${item.port}/${item.dbName}`
                                    : `postgresql://${item.dbUser}:••••••••@${item.containerName}:${item.port}/${item.dbName}`}
                                </code>
                              </div>
                            </div>
                          )}
                        </div>

                        <div style={{ marginTop: 12, borderTop: "1px solid #333", paddingTop: 8 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                            <strong style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 }}>Backups</strong>
                            <button
                              className="btn primary"
                              style={{ padding: "3px 8px", fontSize: 10 }}
                              onClick={() => createBackup(item.id)}
                            >
                              Backup Now
                            </button>
                          </div>
                          {backups[item.id]?.length > 0 ? (
                            <table style={{ width: "100%", fontSize: 11, marginTop: 4 }}>
                              <tbody>
                                {backups[item.id].map((b) => (
                                  <tr key={b.id} style={{ borderBottom: "1px solid #222" }}>
                                    <td style={{ padding: "4px 0", color: "#ccc" }}>
                                      {new Date(b.createdAt).toLocaleString()}
                                    </td>
                                    <td style={{ padding: "4px 0" }}>
                                      <code>{formatSize(b.fileSize)}</code>
                                    </td>
                                    <td style={{ padding: "4px 0" }}>
                                      <span className={`status ${b.status}`} style={{ fontSize: 9, padding: "1px 4px" }}>
                                        {b.status}
                                      </span>
                                    </td>
                                    <td style={{ padding: "4px 0", textAlign: "right" }}>
                                      {b.status === "completed" && (
                                        <>
                                          <a
                                            href={`${apiUrl}/api/projects/${projectId}/databases/${item.id}/backups/${b.id}/download`}
                                            className="btn"
                                            style={{ padding: "2px 6px", fontSize: 9, display: "inline-block", marginRight: 4 }}
                                            target="_blank"
                                            rel="noreferrer"
                                          >
                                            Download
                                          </a>
                                          <button
                                            className="btn"
                                            style={{ padding: "2px 6px", fontSize: 9, marginRight: 4 }}
                                            onClick={() => restoreBackup(item.id, b.id)}
                                          >
                                            Restore
                                          </button>
                                        </>
                                      )}
                                      <button
                                        className="btn danger"
                                        style={{ padding: "2px 6px", fontSize: 9 }}
                                        onClick={() => deleteBackup(item.id, b.id)}
                                      >
                                        Delete
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          ) : (
                            <div style={{ fontSize: 10, color: "#666", fontStyle: "italic", marginTop: 4 }}>
                              No backups created yet.
                            </div>
                          )}
                        </div>
                      </td>
                      <td>
                        <span className={`status ${item.status === "running" ? "running" : item.status === "failed" ? "failed" : "building"}`}>
                          {item.status}
                        </span>
                      </td>
                      <td>
                        <button className="btn danger" onClick={() => removeDatabase(item.id)}>
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </div>

          <div className="two-col" style={{ marginTop: 18 }}>
            <section className="panel">
              <h2>Persistent Volumes</h2>
              <form className="form" onSubmit={addVolume}>
                <div className="field">
                  <label>Volume Name</label>
                  <input
                    value={newVolumeName}
                    onChange={(event) => setNewVolumeName(event.target.value)}
                    placeholder="uploads"
                  />
                </div>
                <div className="field">
                  <label>Mount Path in Container</label>
                  <input
                    value={newVolumePath}
                    onChange={(event) => setNewVolumePath(event.target.value)}
                    placeholder="/app/data"
                  />
                </div>
                <button className="btn primary">Add Volume</button>
              </form>
            </section>

            <section className="panel">
              <h2>Active Volume Mounts</h2>
              <table className="table">
                <thead>
                  <tr>
                    <th>Volume Name</th>
                    <th>Container Mount Path</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {volumes.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <strong>{item.name}</strong>
                      </td>
                      <td>
                        <code>{item.containerPath}</code>
                      </td>
                      <td>
                        <button className="btn danger" onClick={() => removeVolume(item.id)}>
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                  {volumes.length === 0 && (
                    <tr>
                      <td colSpan={3} className="muted" style={{ textAlign: "center", fontStyle: "italic" }}>
                        No persistent volumes configured.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </section>
          </div>

          <section className="panel" style={{ marginTop: 18 }}>
            <h2>Build logs</h2>
            <pre className="log">{logs || "No build logs yet."}</pre>
          </section>

          <section className="panel" style={{ marginTop: 18 }}>
            <div className="header-row">
              <h2>Runtime logs</h2>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 6, cursor: "pointer", color: "#ccc" }}>
                  <input
                    type="checkbox"
                    checked={autoRefreshLogs}
                    onChange={(event) => setAutoRefreshLogs(event.target.checked)}
                  />
                  Auto-refresh (4s)
                </label>
                <button className="btn" onClick={refreshRuntimeLogs}>Refresh</button>
              </div>
            </div>
            <pre className="log">{runtimeLogs || "Runtime logs not loaded."}</pre>
          </section>
        </>
      ) : <p className="muted">Loading project…</p>}
    </main>
  );
}
