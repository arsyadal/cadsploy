import { apiUrl } from "../lib/api";

export default function HomePage() {
  return (
    <main className="shell">
      <nav className="nav">
        <a className="logo" href="/">
          <span className="logo-mark" />
          Cadsploy
        </a>
        <div className="nav-links">
          <a className="btn" href="/dashboard">Dashboard</a>
          <a className="btn primary" href={`${apiUrl}/auth/github`}>Login with GitHub</a>
        </div>
      </nav>

      <section className="hero">
        <div>
          <h1>Deploy<br /><span>anything</span><br />containerized.</h1>
          <p className="lede">
            A brutalist, Docker-first deployment control room for your own VPS. Import GitHub, build image, run container, route subdomain, read logs.
          </p>
          <div className="actions">
            <a className="btn primary" href={`${apiUrl}/auth/github`}>Start shipping</a>
            <a className="btn" href="/dashboard">Open console</a>
          </div>
        </div>
        <aside className="panel">
          <h2>Launch sequence</h2>
          <pre className="terminal">{`$ git push origin main
→ webhook/manual deploy
→ docker build / nixpacks
→ docker run --memory 512m --cpus .5
→ caddy route app.yourdomain.com
✓ live with HTTPS`}</pre>
        </aside>
      </section>

      <section className="grid">
        <div className="card"><strong>Docker-first.</strong><br />Any stack is valid if it can become a container.</div>
        <div className="card"><strong>One VPS MVP.</strong><br />Postgres, Redis, API, worker, Caddy, and user containers.</div>
        <div className="card"><strong>Logs visible.</strong><br />Build and runtime failures are surfaced directly in dashboard.</div>
      </section>
    </main>
  );
}
