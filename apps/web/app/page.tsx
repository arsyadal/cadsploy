"use client";

import { useState, useEffect } from "react";
import { apiUrl } from "../lib/api";

type FrameworkKey = "nextjs" | "express" | "fastapi" | "go";

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<"git" | "build" | "caddy" | "backup">("git");
  const [selectedFramework, setSelectedFramework] = useState<FrameworkKey>("nextjs");
  const [ramLimit, setRamLimit] = useState<number>(512);
  const [cpuLimit, setCpuLimit] = useState<number>(0.5);
  const [pulseCpu, setPulseCpu] = useState<number>(4.2);
  const [pulseMem, setPulseMem] = useState<number>(142);
  const [isCopied, setIsCopied] = useState<boolean>(false);

  // Fluctuating stats for the live server dashboard preview
  useEffect(() => {
    const interval = setInterval(() => {
      setPulseCpu((prev) => {
        const delta = (Math.random() - 0.5) * 1.8;
        const next = parseFloat((prev + delta).toFixed(1));
        return next > 0.5 && next < 12.0 ? next : 4.2;
      });
      setPulseMem((prev) => {
        const delta = Math.floor((Math.random() - 0.5) * 12);
        const next = prev + delta;
        return next > 90 && next < 280 ? next : 142;
      });
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const terminalLogs = {
    git: `$ git add .
$ git commit -m "feat: resource limits & volume backups"
$ git push origin main

Counting objects: 100% (9/9), done.
Delta compression using up to 12 threads
Compressing objects: 100% (6/6), done.
Writing objects: 100% (6/6), 1.2 KiB | 1.2 MiB/s, done.
To github.com:arsyadal/cadsploy.git
   bef2f35..005afba  main -> main
✓ webhook received: triggering deployment pipeline...`,

    build: `[cadsploy-builder] Starting Nixpacks build sequence...
[cadsploy-builder] Detected Node.js (Next.js) environment
[cadsploy-builder] Running install: npm clean-install
[cadsploy-builder] Running build: npm run build
[cadsploy-builder] Creating optimized production build...
✓ Next.js production build compiled successfully
[cadsploy-builder] Exporting container image: cadsploy-app:latest
✓ Image built successfully: 138.4 MB
✓ Deploying container in secure sandbox...`,

    caddy: `[caddy-router] Regenerating Caddyfile configuration...
[caddy-router] Adding route: https://my-app.cadsploy.id -> http://localhost:3000
[caddy-router] Initiating automatic ACME SSL handshake for my-app.cadsploy.id
[caddy-router] Let's Encrypt validation: completed successfully
[caddy-router] Reloading Caddy proxy inside WSL...
✓ Proxy active: http://my-app.cadsploy.id is live with secure HTTPS!`,

    backup: `[volume-backup-worker] Initiating directory backup sequence...
[volume-backup-worker] Target volume: project-data-volume (/app/uploads)
[volume-backup-worker] Compressing folder to .tar.gz via WSL tar...
$ wsl tar -czf backups/backup-vol-2026.tar.gz -C volumes/ app-uploads/
✓ Compression completed: 18.2 MB (.tar.gz)
✓ Volume backup registered successfully in SQLite database
[volume-backup-worker] Status: completed`
  };

  const frameworkBlueprints = {
    nextjs: {
      name: "Next.js",
      install: "npm clean-install",
      build: "npm run build (next build)",
      port: 3000,
      detect: "package.json, next.config.js",
      icon: "▲",
      dockerCommand: "nixpacks build . --name my-nextjs-app"
    },
    express: {
      name: "Node/Express",
      install: "npm install",
      build: "node index.js",
      port: 8080,
      detect: "package.json, index.js",
      icon: "⬢",
      dockerCommand: "nixpacks build . --name my-express-api"
    },
    fastapi: {
      name: "Python FastAPI",
      install: "pip install -r requirements.txt",
      build: "uvicorn main:app --host 0.0.0.0 --port 8000",
      port: 8000,
      detect: "requirements.txt, main.py",
      icon: "🐍",
      dockerCommand: "nixpacks build . --name my-fastapi-app"
    },
    go: {
      name: "Go Fiber",
      install: "go mod download",
      build: "go build -o main . && ./main",
      port: 8080,
      detect: "go.mod, main.go",
      icon: "🐹",
      dockerCommand: "nixpacks build . --name my-go-service"
    }
  };

  const handleCopyCommand = () => {
    navigator.clipboard.writeText("git push origin main");
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <main className="shell" style={{ maxWidth: "1200px" }}>
      {/* 1. Navbar */}
      <nav className="nav" style={{ borderBottom: "1px solid var(--line)", paddingBottom: "20px", marginBottom: "20px" }}>
        <a className="logo" href="/">
          <span className="logo-mark" />
          Cadsploy
          <span style={{ fontSize: "10px", background: "var(--accent)", color: "#111", padding: "1px 6px", marginLeft: "10px", textTransform: "uppercase", letterSpacing: 1, verticalAlign: "middle" }}>
            Beta 1.2
          </span>
        </a>
        <div style={{ display: "flex", gap: "20px", alignItems: "center" }} className="nav-links">
          <a href="#features" className="muted" style={{ fontSize: "13px" }}>Features</a>
          <a href="#templates" className="muted" style={{ fontSize: "13px" }}>Templates</a>
          <a href="#pricing" className="muted" style={{ fontSize: "13px" }}>Pricing</a>
          <a className="btn" href="/dashboard" style={{ fontSize: "13px" }}>Dashboard</a>
          <a className="btn primary" href={`${apiUrl}/auth/github`} style={{ fontSize: "13px" }}>
            <svg style={{ width: 14, height: 14, fill: "currentColor", marginRight: "6px" }} viewBox="0 0 16 16">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
            </svg>
            Sign in
          </a>
        </div>
      </nav>

      {/* 2. Hero Section */}
      <section className="hero" style={{ paddingTop: "40px", paddingBottom: "60px", gap: "32px" }}>
        <div>
          <span style={{ fontSize: "11px", background: "rgba(215, 255, 66, 0.1)", color: "var(--accent)", border: "1px solid rgba(215, 255, 66, 0.3)", padding: "4px 12px", textTransform: "uppercase", letterSpacing: 1, display: "inline-block", marginBottom: "20px" }}>
            ⚡ Absolute Server Sovereignty
          </span>
          <h1 style={{ marginBottom: "16px", fontSize: "clamp(48px, 8vw, 96px)" }}>
            Own your server.<br />
            <span style={{ color: "var(--accent)", textShadow: "0 0 15px rgba(215, 255, 66, 0.25)" }}>Deploy with freedom.</span>
          </h1>
          <p className="lede" style={{ marginBottom: "32px", fontSize: "20px", color: "var(--muted)" }}>
            A developer-first, sovereign deployment platform that turns any VPS into a high-performance control room. Build, deploy, scale, and secure your applications on your own terms without platform premium markups.
          </p>
          <div className="actions" style={{ marginBottom: "40px" }}>
            <a className="btn primary" href={`${apiUrl}/auth/github`} style={{ padding: "14px 28px", fontSize: "15px" }}>
              Deploy to Production
            </a>
            <a className="btn" href="/dashboard" style={{ padding: "14px 28px", fontSize: "15px", border: "1px solid var(--line)" }}>
              Open Console
            </a>
          </div>

          {/* Interactive Resource Limits Simulator widget */}
          <div className="panel" style={{ background: "rgba(26, 24, 18, 0.85)", borderColor: "var(--line)", padding: "20px" }}>
            <h3 style={{ fontFamily: "Archivo Black, sans-serif", fontSize: "13px", textTransform: "uppercase", letterSpacing: 0.5, color: "var(--ink)", margin: "0 0 16px" }}>
              ⚡ Interactive VPS Resource Slice
            </h3>
            
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "20px" }}>
              <div className="field">
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <label style={{ fontSize: "11px" }}>Container RAM: <strong>{ramLimit} MB</strong></label>
                </div>
                <input 
                  type="range" 
                  min="128" 
                  max="4096" 
                  step="128" 
                  value={ramLimit} 
                  onChange={(e) => setRamLimit(parseInt(e.target.value))}
                  style={{ accentColor: "var(--accent)", cursor: "pointer", height: "6px", background: "#222" }}
                />
              </div>

              <div className="field">
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <label style={{ fontSize: "11px" }}>Container CPU: <strong>{cpuLimit} Cores</strong></label>
                </div>
                <input 
                  type="range" 
                  min="0.1" 
                  max="4.0" 
                  step="0.1" 
                  value={cpuLimit} 
                  onChange={(e) => setCpuLimit(parseFloat(e.target.value))}
                  style={{ accentColor: "var(--accent)", cursor: "pointer", height: "6px", background: "#222" }}
                />
              </div>
            </div>

            <div style={{ background: "#0c0b08", borderLeft: "3px solid var(--accent)", padding: "12px 16px", fontFamily: "IBM Plex Mono, monospace", fontSize: "12px" }}>
              <span style={{ color: "#888" }}># Docker Engine Sandbox:</span><br />
              <span style={{ color: "var(--accent)" }}>docker run</span> \
              <br />&nbsp;&nbsp;--memory <span style={{ color: "var(--ink)" }}>"{ramLimit}m"</span> \
              <br />&nbsp;&nbsp;--cpus <span style={{ color: "var(--ink)" }}>"{cpuLimit}"</span> \
              <br />&nbsp;&nbsp;--name cadsploy-app -d -p 80:3000 my-image:latest
            </div>
          </div>
        </div>

        {/* Right Side: Interactive Terminal Deck */}
        <aside className="panel" style={{ display: "flex", flexDirection: "column", height: "100%", justifyContent: "space-between" }}>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
              <h2 style={{ fontFamily: "Archivo Black, sans-serif", fontSize: "14px", textTransform: "uppercase", letterSpacing: 0.5, margin: 0 }}>
                Continuous Delivery Logs
              </h2>
              <button 
                className="btn" 
                style={{ padding: "4px 8px", fontSize: "10px", background: "none", border: "1px solid var(--line)" }}
                onClick={handleCopyCommand}
              >
                {isCopied ? "✓ Copied" : "Copy push hook"}
              </button>
            </div>

            {/* Terminal Switcher Tabs */}
            <div style={{ display: "flex", gap: "4px", borderBottom: "1px solid var(--line)", paddingBottom: "10px", marginBottom: "14px", overflowX: "auto" }}>
              <button 
                onClick={() => setActiveTab("git")} 
                style={{ border: "none", cursor: "pointer", background: activeTab === "git" ? "var(--accent)" : "rgba(255,255,255,0.05)", color: activeTab === "git" ? "#111" : "var(--muted)", padding: "4px 10px", fontSize: "11px", fontWeight: activeTab === "git" ? 700 : 400 }}
              >
                1. Git Push
              </button>
              <button 
                onClick={() => setActiveTab("build")} 
                style={{ border: "none", cursor: "pointer", background: activeTab === "build" ? "var(--accent)" : "rgba(255,255,255,0.05)", color: activeTab === "build" ? "#111" : "var(--muted)", padding: "4px 10px", fontSize: "11px", fontWeight: activeTab === "build" ? 700 : 400 }}
              >
                2. Nixpacks Build
              </button>
              <button 
                onClick={() => setActiveTab("caddy")} 
                style={{ border: "none", cursor: "pointer", background: activeTab === "caddy" ? "var(--accent)" : "rgba(255,255,255,0.05)", color: activeTab === "caddy" ? "#111" : "var(--muted)", padding: "4px 10px", fontSize: "11px", fontWeight: activeTab === "caddy" ? 700 : 400 }}
              >
                3. Caddy SSL
              </button>
              <button 
                onClick={() => setActiveTab("backup")} 
                style={{ border: "none", cursor: "pointer", background: activeTab === "backup" ? "var(--accent)" : "rgba(255,255,255,0.05)", color: activeTab === "backup" ? "#111" : "var(--muted)", padding: "4px 10px", fontSize: "11px", fontWeight: activeTab === "backup" ? 700 : 400 }}
              >
                4. Volumes Backup
              </button>
            </div>

            <pre className="terminal" style={{ minHeight: "310px", fontSize: "11px", border: "1px solid #222", lineHeight: 1.5 }}>
              {terminalLogs[activeTab]}
            </pre>
          </div>
          <div style={{ fontSize: "10px", color: "var(--muted)", marginTop: "14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>⚡ WSL Host-to-Container Bridge Active</span>
            <span style={{ color: "var(--accent)" }}>● Engine Connected</span>
          </div>
        </aside>
      </section>

      {/* 3. Vercel Inspiration: Framework Template Selector section */}
      <section id="templates" className="panel" style={{ marginTop: "40px", background: "rgba(26,24,18,0.3)", padding: "32px", border: "1px solid var(--line)" }}>
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <h2 style={{ fontFamily: "Archivo Black, sans-serif", fontSize: "28px", textTransform: "uppercase", letterSpacing: -0.5, margin: 0 }}>
            Develop with your favorite stacks
          </h2>
          <p className="muted" style={{ fontSize: "14px", marginTop: "6px" }}>
            Cadsploy automatically inspects and configures your project structure using smart Nixpacks blueprints.
          </p>
        </div>

        {/* Selector Buttons */}
        <div style={{ display: "flex", justifyContent: "center", gap: "10px", marginBottom: "32px", flexWrap: "wrap" }}>
          {(Object.keys(frameworkBlueprints) as FrameworkKey[]).map((key) => (
            <button
              key={key}
              onClick={() => setSelectedFramework(key)}
              className="btn"
              style={{
                borderColor: selectedFramework === key ? "var(--accent)" : "var(--line)",
                background: selectedFramework === key ? "rgba(215, 255, 66, 0.08)" : "var(--panel)",
                fontWeight: selectedFramework === key ? 700 : 400
              }}
            >
              <span style={{ marginRight: 8, color: "var(--accent)" }}>{frameworkBlueprints[key].icon}</span>
              {frameworkBlueprints[key].name}
            </button>
          ))}
        </div>

        {/* Blueprint Details Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: "28px" }}>
          <div className="card" style={{ background: "#0a0a07", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #222", paddingBottom: "12px", marginBottom: "16px" }}>
                <strong style={{ fontSize: "14px" }}>Nixpacks Blueprint: {frameworkBlueprints[selectedFramework].name}</strong>
                <span style={{ fontSize: "10px", background: "var(--accent)", color: "#111", padding: "1px 6px" }}>detected</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "12px", fontSize: "12px" }}>
                <div>
                  <span className="muted" style={{ display: "block", fontSize: "10px", textTransform: "uppercase" }}>Auto-Detect Files</span>
                  <code>{frameworkBlueprints[selectedFramework].detect}</code>
                </div>
                <div>
                  <span className="muted" style={{ display: "block", fontSize: "10px", textTransform: "uppercase" }}>Install Command</span>
                  <code>{frameworkBlueprints[selectedFramework].install}</code>
                </div>
                <div>
                  <span className="muted" style={{ display: "block", fontSize: "10px", textTransform: "uppercase" }}>Build/Start Script</span>
                  <code>{frameworkBlueprints[selectedFramework].build}</code>
                </div>
                <div>
                  <span className="muted" style={{ display: "block", fontSize: "10px", textTransform: "uppercase" }}>Application Port</span>
                  <code>{frameworkBlueprints[selectedFramework].port}</code>
                </div>
              </div>
            </div>
            <div style={{ marginTop: "24px", paddingTop: "14px", borderTop: "1px solid #222", fontSize: "11px", color: "var(--muted)" }}>
              ℹ️ No Dockerfile required. Cadsploy compiles dependencies automatically.
            </div>
          </div>

          {/* Blueprint Terminal Execution Visual */}
          <div className="card" style={{ background: "#080806", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div>
              <strong style={{ fontSize: "11px", color: "var(--accent)", textTransform: "uppercase", display: "block", marginBottom: "14px" }}>
                💻 Engine Execution Preview
              </strong>
              <pre style={{ fontSize: "11px", color: "#8dd39e", margin: 0, overflowX: "auto" }}>
                {`$ ${frameworkBlueprints[selectedFramework].dockerCommand}
[nixpacks] building image...
[nixpacks] installing dependencies...
[nixpacks] executing build steps...
✓ Image compilation successful
$ docker run -d \\
  --name cadsploy-app-${selectedFramework} \\
  -p :${frameworkBlueprints[selectedFramework].port} \\
  cadsploy-app-${selectedFramework}:latest`}
              </pre>
            </div>
            <a className="btn primary" style={{ width: "100%", marginTop: "24px" }} href={`${apiUrl}/auth/github`}>
              Deploy This Stack
            </a>
          </div>
        </div>
      </section>

      {/* 4. Interactive Dashboard Mockup Section */}
      <section className="panel" style={{ marginTop: "40px", background: "linear-gradient(180deg, #181611 0%, #11100d 100%)", padding: "32px", border: "1px solid var(--line)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--line)", paddingBottom: "18px", marginBottom: "24px" }}>
          <div>
            <h2 style={{ fontFamily: "Archivo Black, sans-serif", fontSize: "20px", textTransform: "uppercase", letterSpacing: -0.5, margin: 0 }}>
              Live Control Room Mockup
            </h2>
            <p className="muted" style={{ fontSize: "12px", margin: "4px 0 0" }}>
              Visual demonstration of the active Cadsploy dashboard control panel.
            </p>
          </div>
          <span className="status running" style={{ display: "inline-flex", gap: "6px", alignItems: "center" }}>
            <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "var(--ok)", animation: "pulse 1.5s infinite" }} />
            App: Online
          </span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: "28px" }}>
          {/* Mockup Left Side */}
          <div>
            <div className="card" style={{ marginBottom: "20px", background: "#16140f", border: "1px solid #333" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: "16px" }}>cadsploy-production-app</h3>
                  <span className="muted" style={{ fontSize: "11px" }}>Branch: <code>main</code> &bull; Committed by <strong>arsyadal</strong></span>
                </div>
                <div style={{ display: "flex", gap: "6px" }}>
                  <button className="btn primary" style={{ padding: "4px 10px", fontSize: "11px", minHeight: "auto" }}>Deploy</button>
                  <button className="btn" style={{ padding: "4px 10px", fontSize: "11px", minHeight: "auto" }}>Download Logs (.txt)</button>
                </div>
              </div>

              {/* Polling simulation progress bars */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginTop: "20px" }}>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", marginBottom: "6px" }}>
                    <span>CPU Usage</span>
                    <strong>{pulseCpu}%</strong>
                  </div>
                  <div style={{ height: "6px", background: "#222", width: "100%", position: "relative" }}>
                    <div style={{ height: "100%", background: "var(--accent)", width: `${Math.min(pulseCpu * 8, 100)}%`, transition: "width 0.5s ease" }} />
                  </div>
                </div>

                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", marginBottom: "6px" }}>
                    <span>Memory RAM</span>
                    <strong>{pulseMem}MB / {ramLimit}MB</strong>
                  </div>
                  <div style={{ height: "6px", background: "#222", width: "100%", position: "relative" }}>
                    <div style={{ height: "100%", background: "var(--accent)", width: `${Math.min((pulseMem / ramLimit) * 100, 100)}%`, transition: "width 0.5s ease" }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Persistent Volume Mockup */}
            <div className="card" style={{ background: "#16140f" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <strong style={{ fontSize: "12px", textTransform: "uppercase", color: "var(--accent)" }}>📂 Mounted Persistent Volumes</strong>
                <button className="btn" style={{ padding: "2px 8px", fontSize: "10px", minHeight: "auto" }}>+ Add Volume</button>
              </div>
              
              <table style={{ width: "100%", fontSize: "11px" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--line)" }}>
                    <th style={{ padding: "6px 0", color: "#888", textAlign: "left" }}>Volume Name</th>
                    <th style={{ padding: "6px 0", color: "#888", textAlign: "left" }}>Mount Path</th>
                    <th style={{ padding: "6px 0", color: "#888", textAlign: "left" }}>Host Directory</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: "1px solid #222" }}>
                    <td style={{ padding: "8px 0" }}><strong>uploads-data</strong></td>
                    <td style={{ padding: "8px 0" }}><code>/app/uploads</code></td>
                    <td style={{ padding: "8px 0", color: "var(--muted)" }}><code>C:\Cadsploy\volumes\my-app-uploads</code></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Mockup Right Side: Active Volume Backups */}
          <div className="card" style={{ background: "#16140f", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                <strong style={{ fontSize: "12px", textTransform: "uppercase", color: "var(--accent)" }}>💾 Volume Backups (.tar.gz)</strong>
                <button className="btn primary" style={{ padding: "2px 8px", fontSize: "10px", minHeight: "auto" }}>Backup Now</button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <div style={{ border: "1px solid var(--line)", background: "#0e0d0a", padding: "10px", borderRadius: "2px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", marginBottom: "6px" }}>
                    <strong>vol-backup-c58d2.tar.gz</strong>
                    <span style={{ color: "var(--ok)", fontWeight: 700 }}>completed</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: "var(--muted)" }}>
                    <span>Size: <code>18.2 MB</code></span>
                    <span>29/05/2026 11:15 AM</span>
                  </div>
                  <div style={{ display: "flex", gap: "4px", marginTop: "10px", justifyContent: "flex-end" }}>
                    <button className="btn" style={{ padding: "1px 6px", fontSize: "9px", minHeight: "auto" }}>Download</button>
                    <button className="btn" style={{ padding: "1px 6px", fontSize: "9px", minHeight: "auto", borderColor: "var(--accent)" }}>Restore</button>
                  </div>
                </div>

                <div style={{ border: "1px solid var(--line)", background: "#0e0d0a", padding: "10px", borderRadius: "2px", opacity: 0.6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", marginBottom: "6px" }}>
                    <strong>vol-backup-d482a.tar.gz</strong>
                    <span>completed</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: "var(--muted)" }}>
                    <span>Size: <code>17.9 MB</code></span>
                    <span>28/05/2026 09:40 PM</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div style={{ fontSize: "10px", color: "var(--muted)", paddingTop: "12px", borderTop: "1px solid var(--line)", marginTop: "14px" }}>
              ℹ️ Volume backups are stored securely under `backups/` directories on the host PC.
            </div>
          </div>
        </div>
      </section>

      {/* 5. Railway Core Pillars: Develop, Deploy, Scale, Monitor */}
      <h2 id="features" style={{ fontFamily: "Archivo Black, sans-serif", fontSize: "28px", textTransform: "uppercase", letterSpacing: -1, margin: "64px 0 20px", textAlign: "center" }}>
        Engineered for Complete Control
      </h2>

      <section className="grid" style={{ marginBottom: "64px", gap: "20px" }}>
        <div className="card" style={{ padding: "24px" }}>
          <span style={{ fontSize: "10px", background: "rgba(215,255,66,0.1)", color: "var(--accent)", padding: "2px 8px", textTransform: "uppercase", display: "inline-block", marginBottom: "12px" }}>DEVELOP</span>
          <strong style={{ fontSize: "15px", display: "block", marginBottom: "8px" }}>Docker-First Sandbox</strong>
          <p style={{ fontSize: "13px", color: "var(--muted)", margin: 0, lineHeight: 1.4 }}>
            Automatic tech stack detection via Nixpacks or native Dockerfile configurations. If your source code can become a container, Cadsploy can build and run it.
          </p>
        </div>

        <div className="card" style={{ padding: "24px" }}>
          <span style={{ fontSize: "10px", background: "rgba(215,255,66,0.1)", color: "var(--accent)", padding: "2px 8px", textTransform: "uppercase", display: "inline-block", marginBottom: "12px" }}>DEPLOY</span>
          <strong style={{ fontSize: "15px", display: "block", marginBottom: "8px" }}>Zero-Downtime Infrastructure</strong>
          <p style={{ fontSize: "13px", color: "var(--muted)", margin: 0, lineHeight: 1.4 }}>
            Route traffic immediately through pre-configured wildcard subdomains or your own custom domains with automated Let's Encrypt SSL via Caddy Server.
          </p>
        </div>

        <div className="card" style={{ padding: "24px" }}>
          <span style={{ fontSize: "10px", background: "rgba(215,255,66,0.1)", color: "var(--accent)", padding: "2px 8px", textTransform: "uppercase", display: "inline-block", marginBottom: "12px" }}>SCALE</span>
          <strong style={{ fontSize: "15px", display: "block", marginBottom: "8px" }}>Dynamic Resource Caps</strong>
          <p style={{ fontSize: "13px", color: "var(--muted)", margin: 0, lineHeight: 1.4 }}>
            Configure strict memory limits (e.g. `256m`, `512m`, `1g`, `2g`) and precise CPU core quotas per project directly from the dashboard to protect your host.
          </p>
        </div>

        <div className="card" style={{ padding: "24px" }}>
          <span style={{ fontSize: "10px", background: "rgba(215,255,66,0.1)", color: "var(--accent)", padding: "2px 8px", textTransform: "uppercase", display: "inline-block", marginBottom: "12px" }}>MONITOR</span>
          <strong style={{ fontSize: "15px", display: "block", marginBottom: "8px" }}>Real-time Observability</strong>
          <p style={{ fontSize: "13px", color: "var(--muted)", margin: 0, lineHeight: 1.4 }}>
            Expose real-time container metrics, track live build outputs, toggle auto-refreshing log queues, and download complete container outputs as standard `.txt` files.
          </p>
        </div>

        <div className="card" style={{ padding: "24px" }}>
          <span style={{ fontSize: "10px", background: "rgba(215,255,66,0.1)", color: "var(--accent)", padding: "2px 8px", textTransform: "uppercase", display: "inline-block", marginBottom: "12px" }}>STORE</span>
          <strong style={{ fontSize: "15px", display: "block", marginBottom: "8px" }}>WSL Volume Backups</strong>
          <p style={{ fontSize: "13px", color: "var(--muted)", margin: 0, lineHeight: 1.4 }}>
            Mount host directories directly into containers for storage persistence. Create compressed `.tar.gz` volume backups and restore data with one-click asynchrony.
          </p>
        </div>

        <div className="card" style={{ padding: "24px" }}>
          <span style={{ fontSize: "10px", background: "rgba(215,255,66,0.1)", color: "var(--accent)", padding: "2px 8px", textTransform: "uppercase", display: "inline-block", marginBottom: "12px" }}>PROVISION</span>
          <strong style={{ fontSize: "15px", display: "block", marginBottom: "8px" }}>One-Click Managed DBs</strong>
          <p style={{ fontSize: "13px", color: "var(--muted)", margin: 0, lineHeight: 1.4 }}>
            Deploy standalone PostgreSQL or Redis database services immediately on your VPS, fully isolated and configured with automatic database backup pipelines.
          </p>
        </div>
      </section>

      {/* 6. Pricing Plans */}
      <h2 id="pricing" style={{ fontFamily: "Archivo Black, sans-serif", fontSize: "28px", textTransform: "uppercase", letterSpacing: -1, margin: "64px 0 20px", textAlign: "center" }}>
        Simple, Predictable Plans
      </h2>
      <p className="muted" style={{ fontSize: "14px", textAlign: "center", maxWidth: "680px", margin: "-10px auto 40px", lineHeight: 1.5 }}>
        Choose the deployment scale that fits your workflow. Note that payment integrations (Billing) are explicitly marked as Out of Scope in the prd.md specification, making these plans illustrative of future capabilities.
      </p>

      <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "28px", marginBottom: "64px", maxWidth: "860px", marginLeft: "auto", marginRight: "auto" }}>
        {/* Free Plan */}
        <div className="card" style={{ padding: "32px", border: "1px solid var(--line)", background: "rgba(26, 24, 18, 0.8)", display: "flex", flexDirection: "column", justifyContent: "space-between", position: "relative" }}>
          <div>
            <span style={{ fontSize: "10px", background: "rgba(255,255,255,0.08)", color: "var(--muted)", padding: "2px 8px", textTransform: "uppercase", letterSpacing: 0.5 }}>DEVELOPER</span>
            <h3 style={{ fontFamily: "Archivo Black, sans-serif", fontSize: "24px", margin: "10px 0" }}>Free Tier</h3>
            <div style={{ margin: "14px 0 20px" }}>
              <span style={{ fontSize: "36px", fontFamily: "Archivo Black, sans-serif", color: "var(--accent)" }}>$0</span>
              <span className="muted" style={{ fontSize: "12px" }}> / forever</span>
            </div>
            <p style={{ fontSize: "13px", color: "var(--muted)", lineHeight: 1.4, marginBottom: "20px", borderBottom: "1px solid var(--line)", paddingBottom: "14px" }}>
              Perfect for hosting personal portfolios, testing docker containers, and running hobby projects.
            </p>
            <ul style={{ paddingLeft: "18px", fontSize: "12px", lineHeight: 2, color: "var(--ink)", margin: 0 }}>
              <li>1 Active Project Limit</li>
              <li>Maximum <code>256 MB</code> Container RAM</li>
              <li>Maximum <code>0.2 CPU Cores</code> Allocation</li>
              <li>Free Subdomain Routing (<code>*.cadsploy.id</code>)</li>
              <li>SQLite Local Database (via Persistent Volume)</li>
              <li>Auto-idles container after 15 minutes of inactivity</li>
            </ul>
          </div>
          <a className="btn" href={`${apiUrl}/auth/github`} style={{ marginTop: "32px", width: "100%" }}>
            Start Shipping Free
          </a>
        </div>

        {/* Pro Plan */}
        <div className="card" style={{ padding: "32px", border: "2px solid var(--accent)", background: "rgba(26, 24, 18, 0.95)", display: "flex", flexDirection: "column", justifyContent: "space-between", position: "relative", boxShadow: "6px 6px 0 #000" }}>
          <div style={{ position: "absolute", top: "-12px", right: "20px", background: "var(--accent)", color: "#111", padding: "2px 10px", fontSize: "9px", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>POPULAR</div>
          <div>
            <span style={{ fontSize: "10px", background: "var(--accent)", color: "#111", padding: "2px 8px", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700 }}>PRODUCTION</span>
            <h3 style={{ fontFamily: "Archivo Black, sans-serif", fontSize: "24px", margin: "10px 0" }}>Pro Cloud</h3>
            <div style={{ margin: "14px 0 20px" }}>
              <span style={{ fontSize: "36px", fontFamily: "Archivo Black, sans-serif", color: "var(--accent)" }}>$6</span>
              <span className="muted" style={{ fontSize: "12px" }}> / month</span>
            </div>
            <p style={{ fontSize: "13px", color: "var(--muted)", lineHeight: 1.4, marginBottom: "20px", borderBottom: "1px solid var(--line)", paddingBottom: "14px" }}>
              Designed for running production SaaS APIs, client databases, and active production workloads.
            </p>
            <ul style={{ paddingLeft: "18px", fontSize: "12px", lineHeight: 2, color: "var(--ink)", margin: 0 }}>
              <li><strong>Up to 10 Active Projects</strong></li>
              <li>Maximum <code>2 GB</code> RAM per container</li>
              <li>Maximum <code>2.0 CPU Cores</code> (full scheduling priority)</li>
              <li>Connect Your Custom Domains</li>
              <li><strong>Dedicated Database</strong> Containers (Postgres, Redis)</li>
              <li>Always-On 24/7 (No Auto-idling)</li>
              <li>Daily automated volume backups (.tar.gz)</li>
            </ul>
          </div>
          <a className="btn primary" href={`${apiUrl}/auth/github`} style={{ marginTop: "32px", width: "100%" }}>
            Go Pro Now
          </a>
        </div>
      </section>

      {/* 7. Call to Action (CTA) */}
      <section className="panel" style={{ textAlign: "center", padding: "48px 24px", background: "var(--accent)", color: "#111", border: "3px solid #000", boxShadow: "12px 12px 0 #000", marginBottom: "80px" }}>
        <h2 style={{ fontFamily: "Archivo Black, sans-serif", fontSize: "36px", textTransform: "uppercase", letterSpacing: -1, margin: "0 0 14px", color: "#111" }}>
          Ready to Deploy?
        </h2>
        <p style={{ fontFamily: "Libre Baskerville, serif", fontSize: "18px", margin: "0 0 28px", color: "#333", maxWidth: "680px", marginLeft: "auto", marginRight: "auto" }}>
          Start building with a free account. Import your GitHub repository, configure settings, and launch your application instantly.
        </p>
        <a className="btn" href={`${apiUrl}/auth/github`} style={{ background: "#111", color: "var(--accent)", border: "2px solid #111", padding: "16px 36px", fontSize: "16px", fontWeight: 700 }}>
          Get Started for Free
        </a>
      </section>
      
      {/* Vercel Inspiration: All systems normal & display theme Mockup Footer */}
      <footer style={{ borderTop: "1px solid var(--line)", paddingTop: "24px", paddingBottom: "48px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px", fontSize: "12px", color: "var(--muted)" }}>
        <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
          <span>© 2026 Cadsploy PaaS. Self-hosted & Sovereign.</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "var(--ok)", animation: "pulse 1.5s infinite" }} />
            <span style={{ color: "var(--ok)", fontWeight: 600 }}>All systems normal</span>
          </div>
        </div>
      </footer>

      {/* Styles animation block */}
      <style jsx global>{`
        @keyframes pulse {
          0% { transform: scale(0.95); opacity: 0.5; }
          50% { transform: scale(1.05); opacity: 1; }
          100% { transform: scale(0.95); opacity: 0.5; }
        }
      `}</style>
    </main>
  );
}
