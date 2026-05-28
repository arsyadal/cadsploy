"use client";

import Link from "next/link";

export default function NotFound() {
  return (
    <main className="shell" style={{ minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "center" }}>
      <header className="nav">
        <Link href="/" className="logo">
          <div className="logo-mark" />
          <span>CADSPLOY</span>
        </Link>
      </header>

      <section style={{ margin: "auto 0", padding: "40px 0", textAlign: "center" }}>
        <h1 
          className="title" 
          style={{ 
            fontSize: "clamp(80px, 15vw, 180px)", 
            color: "var(--danger)",
            textShadow: "8px 8px 0 #000",
            marginBottom: "16px"
          }}
        >
          404
        </h1>
        <p className="lede" style={{ margin: "0 auto 36px", textAlign: "center" }}>
          The requested container or route could not be found.
        </p>

        <div 
          className="panel" 
          style={{ 
            maxWidth: "640px", 
            margin: "0 auto 40px", 
            textAlign: "left",
            fontFamily: '"IBM Plex Mono", monospace'
          }}
        >
          <h2 style={{ fontSize: "16px", textTransform: "uppercase", color: "var(--muted)", margin: "0 0 14px", display: "flex", justifyContent: "space-between" }}>
            <span>Routing Diagnostics</span>
            <span style={{ color: "var(--danger)" }}>● OFFLINE</span>
          </h2>
          
          <div className="terminal" style={{ minHeight: "180px", fontSize: "14px" }}>
            <span style={{ color: "var(--muted)" }}>$</span> cadsploy resolve-route <span style={{ color: "var(--accent)" }}>/dsasda</span>
            {"\n"}<span style={{ color: "var(--muted)" }}>[system]</span> initializing router...
            {"\n"}<span style={{ color: "var(--muted)" }}>[system]</span> querying active docker containers...
            {"\n"}<span style={{ color: "var(--muted)" }}>[system]</span> scanning subdomain mappings...
            {"\n"}<span style={{ color: "var(--danger)" }}>[error] 404 Not Found</span>
            {"\n"}<span style={{ color: "var(--danger)" }}>[error]</span> no active deployment matches route "/dsasda"
            {"\n"}<span style={{ color: "var(--danger)" }}>[error]</span> exit code: 404
          </div>
        </div>

        <div>
          <Link href="/" className="btn primary" style={{ fontSize: "16px" }}>
            Return to Dashboard
          </Link>
        </div>
      </section>

      <footer style={{ marginTop: "auto", padding: "28px 0 0", borderTop: "1px solid var(--line)", textAlign: "center", color: "var(--muted)", fontSize: "13px" }}>
        &copy; {new Date().getFullYear()} Cadsploy. All rights reserved.
      </footer>
    </main>
  );
}
