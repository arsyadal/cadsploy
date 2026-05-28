"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { apiFetch } from "../../../lib/api";

type Repo = {
  id: number;
  name: string;
  fullName: string;
  owner: string;
  private: boolean;
  cloneUrl: string;
  defaultBranch: string;
};

type RepoResponse = { repos: Repo[] };
type BranchResponse = { branches: string[] };

type ProjectResponse = { project: { id: string } };

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48);
}

export default function NewProjectPage() {
  const [repos, setRepos] = useState<Repo[]>([]);
  const [repoFullName, setRepoFullName] = useState("");
  const [branches, setBranches] = useState<string[]>([]);
  const [branch, setBranch] = useState("");
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [buildMethod, setBuildMethod] = useState("dockerfile");
  const [appPort, setAppPort] = useState(3000);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const selectedRepo = useMemo(() => repos.find((repo) => repo.fullName === repoFullName), [repos, repoFullName]);

  useEffect(() => {
    async function loadRepos() {
      try {
        const payload = await apiFetch<RepoResponse>("/api/repos");
        setRepos(payload.repos);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load repositories");
      }
    }
    void loadRepos();
  }, []);

  useEffect(() => {
    if (!selectedRepo) return;
    setName(selectedRepo.name);
    setSlug(slugify(selectedRepo.name));
    setBranch(selectedRepo.defaultBranch);
    async function loadBranches() {
      if (!selectedRepo) return;
      const payload = await apiFetch<BranchResponse>(`/api/repos/${selectedRepo.owner}/${selectedRepo.name}/branches`);
      setBranches(payload.branches);
    }
    void loadBranches();
  }, [selectedRepo]);

  async function createProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedRepo) return;
    setLoading(true);
    setError("");
    try {
      const payload = await apiFetch<ProjectResponse>("/api/projects", {
        method: "POST",
        body: JSON.stringify({
          name,
          slug,
          repoOwner: selectedRepo.owner,
          repoName: selectedRepo.name,
          repoUrl: selectedRepo.cloneUrl,
          branch,
          buildMethod,
          appPort,
        }),
      });
      window.location.href = `/projects/${payload.project.id}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project");
      setLoading(false);
    }
  }

  return (
    <main className="shell">
      <nav className="nav">
        <a className="logo" href="/"><span className="logo-mark" />Cadsploy</a>
        <div className="nav-links"><a className="btn" href="/dashboard">Dashboard</a></div>
      </nav>

      <div className="header-row">
        <h1 className="title">Import repo</h1>
      </div>

      <section className="panel">
        <form className="form" onSubmit={createProject}>
          <div className="field">
            <label>Repository</label>
            <select value={repoFullName} onChange={(event) => setRepoFullName(event.target.value)} required>
              <option value="">Choose repository</option>
              {repos.map((repo) => <option key={repo.id} value={repo.fullName}>{repo.fullName}{repo.private ? " private" : ""}</option>)}
            </select>
          </div>

          <div className="field"><label>Project name</label><input value={name} onChange={(event) => setName(event.target.value)} required /></div>
          <div className="field"><label>Slug</label><input value={slug} onChange={(event) => setSlug(slugify(event.target.value))} required /></div>

          <div className="two-col">
            <div className="field">
              <label>Branch</label>
              <select value={branch} onChange={(event) => setBranch(event.target.value)} required>
                {branches.length === 0 ? <option value={branch}>{branch || "Select repo first"}</option> : null}
                {branches.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </div>
            <div className="field">
              <label>App port</label>
              <input type="number" min="1" max="65535" value={appPort} onChange={(event) => setAppPort(Number(event.target.value))} required />
            </div>
          </div>

          <div className="field">
            <label>Build method</label>
            <select value={buildMethod} onChange={(event) => setBuildMethod(event.target.value)}>
              <option value="dockerfile">Dockerfile</option>
              <option value="nixpacks">Nixpacks auto-detect</option>
            </select>
          </div>

          {error ? <p className="error">{error}</p> : null}
          <button className="btn primary" disabled={loading}>{loading ? "Creating…" : "Create Project"}</button>
        </form>
      </section>
    </main>
  );
}
