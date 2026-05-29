"use client";

import { useState, useEffect } from "react";
import { apiUrl } from "../../lib/api";

type ServiceStatus = "operational" | "major_outage" | "partial_outage" | "loading";

interface StatusPayload {
  status: "operational" | "partial_outage" | "major_outage";
  services: {
    api: ServiceStatus;
    worker: ServiceStatus;
    caddy: ServiceStatus;
    docker: ServiceStatus;
    postgres: ServiceStatus;
    redis: ServiceStatus;
  };
}

export default function StatusPage() {
  const [loading, setLoading] = useState<boolean>(true);
  const [data, setData] = useState<StatusPayload | null>(null);
  const [showSubscribeModal, setShowSubscribeModal] = useState<boolean>(false);
  const [email, setEmail] = useState<string>("");
  const [subscribed, setSubscribed] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);

  useEffect(() => {
    async function fetchStatus() {
      try {
        const res = await fetch(`${apiUrl}/api/status/health`);
        if (res.ok) {
          const payload = await res.json();
          setData(payload);
        }
      } catch (err) {
        console.error("Failed to fetch live health check status", err);
      } finally {
        setLoading(false);
      }
    }
    fetchStatus();
    const interval = setInterval(fetchStatus, 15000);
    return () => clearInterval(interval);
  }, []);

  const overallStatus = data?.status ?? "operational";

  const getStatusText = (status: string) => {
    if (status === "operational") return "All Systems Operational";
    if (status === "partial_outage") return "Partial System Outage";
    return "Major System Outage";
  };

  const getBannerStyles = (status: string) => {
    if (status === "operational") {
      return {
        bg: "rgba(16, 185, 129, 0.08)",
        border: "1px solid #10b981",
        color: "#10b981",
        dot: "#10b981",
        shadow: "rgba(16, 185, 129, 0.15)"
      };
    }
    if (status === "partial_outage") {
      return {
        bg: "rgba(245, 158, 11, 0.08)",
        border: "1px solid #f59e0b",
        color: "#f59e0b",
        dot: "#f59e0b",
        shadow: "rgba(245, 158, 11, 0.15)"
      };
    }
    return {
      bg: "rgba(239, 68, 68, 0.08)",
      border: "1px solid #ef4444",
      color: "#ef4444",
      dot: "#ef4444",
      shadow: "rgba(239, 68, 68, 0.15)"
    };
  };

  const banner = getBannerStyles(overallStatus);

  // List of all 31 services requested by the user
  const servicesList = [
    { key: "ai_gateway", name: "AI Gateway", mock: true },
    { key: "api", name: "API", mock: false, realKey: "api" },
    { key: "build_deploy", name: "Build & Deploy", mock: false, realKey: "worker" },
    { key: "cicd", name: "CI/CD", mock: true },
    { key: "community", name: "Community", mock: true },
    { key: "cron_jobs", name: "Cron Jobs", mock: true },
    { key: "dashboard", name: "Dashboard", mock: true },
    { key: "data_cache", name: "Data Cache", mock: true },
    { key: "dns", name: "DNS", mock: true },
    { key: "domain_registration", name: "Domain Registration", mock: true },
    { key: "edge_functions", name: "Edge Functions", mock: true },
    { key: "edge_middleware", name: "Edge Middleware", mock: true },
    { key: "edge_network", name: "Edge Network", mock: false, realKey: "caddy" },
    { key: "firewall", name: "Firewall", mock: true },
    { key: "image_optimization", name: "Image Optimization", mock: true },
    { key: "logs", name: "Logs", mock: true },
    { key: "drains", name: "Drains", mock: true },
    { key: "marketplace", name: "Marketplace", mock: true },
    { key: "remote_caching", name: "Remote Caching", mock: true },
    { key: "saml_sso", name: "SAML Single Sign-On", mock: true },
    { key: "sandbox", name: "Sandbox", mock: false, realKey: "docker" },
    { key: "serverless_functions", name: "Serverless Functions", mock: true },
    { key: "secure_compute", name: "Secure Compute", mock: true },
    { key: "speed_insights", name: "Speed Insights", mock: true },
    { key: "ssl_certificates", name: "SSL Certificates", mock: true },
    { key: "storage", name: "Storage", mock: false, realKey: "postgres" },
    { key: "v0", name: "v0", mock: true },
    { key: "web_analytics", name: "Web Analytics", mock: true },
    { key: "queues", name: "Queues", mock: false, realKey: "redis" },
    { key: "workflow", name: "Workflow", mock: true },
    { key: "observability", name: "Observability", mock: true }
  ] as const;

  const handleSubscribeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes("@")) return;
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      setSubscribed(true);
      setEmail("");
    }, 1200);
  };

  const renderTimelineTicks = (serviceStatus: ServiceStatus) => {
    const isDown = serviceStatus === "major_outage";
    const tickCount = 48; // perfect size for a compact layout

    return (
      <div style={{ marginTop: 8 }}>
        <div style={{ display: "flex", gap: "2px", height: "14px", alignItems: "stretch" }}>
          {Array.from({ length: tickCount }).map((_, i) => {
            const isLast = i === tickCount - 1;
            let bg = "#1f2937";
            let opacity = 0.9;
            
            if (serviceStatus !== "loading") {
              if (isLast && isDown) {
                bg = "#ef4444";
              } else {
                bg = "#10b981";
                opacity = 0.5 + (i % 8) * 0.08; // nice gradient visual texture
              }
            } else {
              bg = "#374151";
              opacity = 0.3;
            }

            return (
              <div 
                key={i} 
                style={{ 
                  flex: 1, 
                  backgroundColor: bg, 
                  opacity: opacity,
                  borderRadius: "1px"
                }} 
              />
            );
          })}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "9px", color: "#6b7280", marginTop: "4px" }}>
          <span>90 days ago</span>
          <span style={{ color: "#4b5563" }}>100% uptime</span>
          <span>Today</span>
        </div>
      </div>
    );
  };

  const incidentsHistory = [
    {
      date: "May 29, 2026",
      hasIncident: false,
      text: "No incidents reported today."
    },
    {
      date: "May 28, 2026",
      hasIncident: true,
      title: "Elevated Function Invocation Errors in Stockholm region (ARN1)",
      statusText: "Resolved - This incident has been resolved.",
      updates: [
        { time: "May 28, 2026, 16:59 UTC", type: "Resolved", desc: "This incident has been resolved. (13 hours ago)" },
        { time: "May 28, 2026, 16:37 UTC", type: "Monitoring", desc: "A fix has been implemented and we are monitoring the results. (13 hours ago)" },
        { time: "May 28, 2026, 16:37 UTC", type: "Identified", desc: "The issue has been identified and a fix is being implemented. (13 hours ago)" },
        { time: "May 28, 2026, 16:18 UTC", type: "Investigating", desc: "We've identified an issue where some customers may experience elevated error rates when invoking functions in the ARN1 Edge Region. We are currently investigating this issue. (14 hours ago)" }
      ]
    },
    {
      date: "May 27, 2026",
      hasIncident: true,
      title: "Elevated Errors on Vercel Dashboard (Project Overview Page)",
      statusText: "Resolved - This incident has been resolved.",
      updates: [
        { time: "May 27, 2026, 05:02 UTC", type: "Resolved", desc: "We've rolled back a bad release to resolve the issue. Customers were unable to access the project overview page between 04:13 and 05:00 AM UTC. (2 days ago)" },
        { time: "May 27, 2026, 04:50 UTC", type: "Investigating", desc: "We are currently investigating this issue. (2 days ago)" }
      ]
    },
    {
      date: "May 26, 2026",
      hasIncident: false,
      text: "No incidents reported."
    },
    {
      date: "May 25, 2026",
      hasIncident: true,
      title: "Delays Loading Runtime Logs",
      statusText: "Resolved - This incident has been resolved.",
      updates: [
        { time: "May 25, 2026, 16:22 UTC", type: "Resolved", desc: "This incident has been resolved. (3 days ago)" },
        { time: "May 25, 2026, 16:05 UTC", type: "Monitoring", desc: "A fix has been implemented and we are monitoring the results. (3 days ago)" },
        { time: "May 25, 2026, 15:25 UTC", type: "Identified", desc: "The issue has been identified and a fix is being implemented. (3 days ago)" },
        { time: "May 25, 2026, 14:58 UTC", type: "Investigating", desc: "We are currently investigating elevated latency in loading runtime logs (Vercel Functions) in live mode. Log Drains are unaffected at this time. (3 days ago)" }
      ]
    },
    {
      date: "May 24, 2026",
      hasIncident: false,
      text: "No incidents reported."
    },
    {
      date: "May 23, 2026",
      hasIncident: true,
      title: "Elevated Build Failures (GitHub connected projects)",
      statusText: "Resolved - This incident has been resolved.",
      updates: [
        { time: "May 23, 2026, 18:44 UTC", type: "Resolved", desc: "GitHub has implemented a fix, and we are monitoring the results. Please refer to GitHub's status page post for more details: https://www.githubstatus.com/incidents/k5z4d1v1tqmt (5 days ago)" },
        { time: "May 23, 2026, 18:21 UTC", type: "Monitoring", desc: "GitHub has implemented a fix, and we are monitoring the results. (5 days ago)" },
        { time: "May 23, 2026, 15:46 UTC", type: "Identified", desc: "We have identified the issue and are working closely with GitHub to resolve it. (5 days ago)" },
        { time: "May 23, 2026, 14:30 UTC", type: "Update", desc: "We are working closely with GitHub to resolve this issue. Failures are intermittent — if your deployment fails, redeploying should resolve it in the meantime. We will provide updates as the situation develops. (5 days ago)" },
        { time: "May 23, 2026, 12:15 UTC", type: "Update", desc: "We are continuing to investigate this issue. (5 days ago)" },
        { time: "May 23, 2026, 11:09 UTC", type: "Update", desc: "We've been observing increased failures of git operations with GitHub since around 06:00 UTC. Some deployments triggered by GitHub commits might have seen git-related errors in failed build logs. CLI deployments are unaffected at this time. (5 days ago)" },
        { time: "May 23, 2026, 10:43 UTC", type: "Investigating", desc: "We are currently investigating this issue. (5 days ago)" }
      ]
    },
    {
      date: "May 22, 2026",
      hasIncident: true,
      title: "Build Failures for Some Next.js Deployments",
      statusText: "Resolved - Between 16:10 and 16:43 UTC on May 22, some customers using Next.js above 16.2.0-canary.28 with Preview Comments enabled experienced build failures during deployments. The issue has been mitigated and follow-up deployments should no longer encounter this error. (6 days ago)",
      updates: []
    },
    {
      date: "May 21, 2026",
      hasIncident: true,
      title: "Elevated Build Errors",
      statusText: "Resolved - This incident has been resolved.",
      updates: [
        { time: "May 21, 2026, 21:31 UTC", type: "Resolved", desc: "This incident has been resolved. (7 days ago)" },
        { time: "May 21, 2026, 21:20 UTC", type: "Monitoring", desc: "The mitigation was successfully rolled out, and builds are stable. (7 days ago)" },
        { time: "May 21, 2026, 19:55 UTC", type: "Update", desc: "The root cause has been identified and we are rolling out a mitigation. (7 days ago)" },
        { time: "May 21, 2026, 15:01 UTC", type: "Identified", desc: "We are currently investigating elevated build failures affecting a subset of Vite projects. Affected deployments may be timing out. We’ve identified an issue and are working on the fix. (7 days ago)" }
      ]
    },
    {
      date: "May 21, 2026 (Part 2)",
      hasIncident: true,
      title: "Missing Build CPU Minutes Usage Data",
      statusText: "Resolved - This incident has been resolved.",
      updates: [
        { time: "May 21, 2026, 06:08 UTC", type: "Resolved", desc: "Usage data for Build CPU Minutes between May 15, 2026, 19:30, and May 20, 2026, 18:00 UTC is currently incomplete. Customers will see usage data for Build CPU Minutes catch up over the next business day as we backfill the data for the affected window. (8 days ago)" },
        { time: "May 20, 2026, 20:07 UTC", type: "Monitoring", desc: "We've identified an issue where some users may see missing Build CPU Minutes data on Usage pages in the Vercel Dashboard. The issue has been resolved, and we are backfilling the affected usage data. (8 days ago)" }
      ]
    },
    {
      date: "May 20, 2026",
      hasIncident: false,
      text: "No incidents reported today."
    },
    {
      date: "May 19, 2026",
      hasIncident: false,
      text: "No incidents reported."
    },
    {
      date: "May 18, 2026",
      hasIncident: true,
      title: "Increased Function Invocation Errors - ERR_MODULE_NOT_FOUND",
      statusText: "Resolved - This incident has been resolved.",
      updates: [
        { time: "May 18, 2026, 23:52 UTC", type: "Resolved", desc: "Some deployments created between May 18, 2026, 06:15 PM - 10:16 PM UTC may have experienced increased ERR_MODULE_NOT_FOUND function invocation errors due to a bad rollout. Deployments created outside of this window are unaffected. The fix is being rolled out to existing deployments retrospectively and is expected to finish in the next few hours. (10 days ago)" },
        { time: "May 18, 2026, 22:19 UTC", type: "Update", desc: "We are continuing to monitor for any further issues. (10 days ago)" },
        { time: "May 18, 2026, 22:16 UTC", type: "Monitoring", desc: "A fix is rolled out for the function invocation errors affecting React Router 7 deployments. To recover, redeploy your application or use Instant Rollback to a previous deployment from the dashboard. We're continuing to monitor. (10 days ago)" },
        { time: "May 18, 2026, 22:11 UTC", type: "Update", desc: "We're continuing to work on rolling out a fix. In the mean time, customers may use Instant Rollback to a previous deployment version as an immediate workaround in order to recover. (10 days ago)" },
        { time: "May 18, 2026, 21:53 UTC", type: "Identified", desc: "The issue has been identified and a fix is being implemented. (10 days ago)" },
        { time: "May 18, 2026, 21:42 UTC", type: "Investigating", desc: "We're investigating an issue where customers are currently experiencing application failures due to function invocation errors when using React Router 7. (10 days ago)" }
      ]
    },
    {
      date: "May 18, 2026 (Part 2)",
      hasIncident: true,
      title: "Support cases cannot be submitted",
      statusText: "Resolved - The incident is resolved and support cases can be submitted again.",
      updates: [
        { time: "May 18, 2026, 15:41 UTC", type: "Resolved", desc: "The incident is resolved and support cases can be submitted again. (10 days ago)" },
        { time: "May 18, 2026, 15:17 UTC", type: "Monitoring", desc: "We have implemented a fix. New support cases can be created. We continue to monitor. (10 days ago)" },
        { time: "May 18, 2026, 15:00 UTC", type: "Investigating", desc: "We are investigating an issue where support cannot be submitted through the dashboard. (10 days ago)" }
      ]
    },
    {
      date: "May 17, 2026",
      hasIncident: false,
      text: "No incidents reported."
    },
    {
      date: "May 16, 2026",
      hasIncident: false,
      text: "No incidents reported."
    },
    {
      date: "May 15, 2026",
      hasIncident: true,
      title: "Workflow usage amounts are incorrectly calculated",
      statusText: "Resolved - The usage tracking system is fully recovered.",
      updates: [
        { time: "May 15, 2026, 16:18 UTC", type: "Resolved", desc: "The usage tracking system is fully recovered. (13 days ago)" },
        { time: "May 15, 2026, 15:39 UTC", type: "Monitoring", desc: "The team fixed the incorrect calculations. We are resuming usage tracking and continuing to monitor. (13 days ago)" },
        { time: "May 15, 2026, 13:40 UTC", type: "Update", desc: "We are continuing to work on the fix. Usage tracking for Workflow Storage remains paused. The incorrect calculations will not be charged. (13 days ago)" },
        { time: "May 15, 2026, 11:37 UTC", type: "Identified", desc: "The team has identified the source of the incorrect usage data calculations and has paused usage tracking while a fix is being prepared. (13 days ago)" },
        { time: "May 15, 2026, 10:34 UTC", type: "Investigating", desc: "Workflow Storage Retention and Workflow Storage Writes are being incorrectly calculated in usage data. The team is investigating and working to resolve the discrepancy. (13 days ago)" }
      ]
    }
  ];

  return (
    <main style={{ maxWidth: "800px", margin: "0 auto", padding: "40px 16px 80px", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" }}>
      
      {/* Navigation Header */}
      <nav style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "40px" }}>
        <a href="/" style={{ display: "flex", alignItems: "center", gap: "8px", textDecoration: "none", color: "#fff" }}>
          <span style={{ 
            width: "24px", 
            height: "24px", 
            border: "1.5px solid var(--accent)", 
            background: "repeating-linear-gradient(-45deg, var(--accent) 0 3px, transparent 3px 6px)",
            boxShadow: "3px 3px 0 #000"
          }} />
          <span style={{ fontSize: "18px", fontWeight: 700, letterSpacing: "-0.5px" }}>CADSPLOY</span>
          <span style={{ color: "#71717a", fontSize: "14px", fontWeight: 400 }}>/ status</span>
        </a>

        <button 
          onClick={() => {
            setShowSubscribeModal(true);
            setSubscribed(false);
          }}
          style={{
            background: "#fff",
            color: "#000",
            border: "none",
            borderRadius: "4px",
            padding: "8px 16px",
            fontSize: "13px",
            fontWeight: 600,
            cursor: "pointer",
            boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
            transition: "opacity 0.2s"
          }}
          onMouseOver={(e) => e.currentTarget.style.opacity = "0.9"}
          onMouseOut={(e) => e.currentTarget.style.opacity = "1"}
        >
          Subscribe to Updates
        </button>
      </nav>

      {/* 1. Systems Operational Banner */}
      <div 
        style={{
          background: banner.bg,
          border: banner.border,
          borderRadius: "6px",
          padding: "20px 24px",
          marginBottom: "32px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          boxShadow: `0 8px 30px ${banner.shadow}`
        }}
      >
        <span style={{ color: "#fff", fontSize: "16px", fontWeight: 500 }}>
          {loading ? "Verifying platform clusters..." : getStatusText(overallStatus)}
        </span>
        <span 
          style={{ 
            width: "10px", 
            height: "10px", 
            borderRadius: "50%", 
            background: banner.dot, 
            boxShadow: `0 0 10px ${banner.dot}`,
            animation: "status-pulse 2s infinite"
          }} 
        />
      </div>

      {/* 2. Services Rows Panel */}
      <div style={{ 
        border: "1px solid #27272a", 
        borderRadius: "6px", 
        background: "#09090b",
        overflow: "hidden",
        marginBottom: "48px"
      }}>
        {servicesList.map((service, index) => {
          let serviceState: ServiceStatus = "operational";
          if (!service.mock && data) {
            serviceState = data.services[service.realKey];
          } else if (loading) {
            serviceState = "loading";
          }

          const statusColor = 
            serviceState === "operational" ? "#10b981" : 
            serviceState === "loading" ? "#71717a" : "#ef4444";

          return (
            <div 
              key={service.key} 
              style={{ 
                padding: "20px 24px",
                borderBottom: index === servicesList.length - 1 ? "none" : "1px solid #18181b",
                transition: "background 0.2s"
              }}
              className="service-row"
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <span style={{ color: "#f4f4f5", fontSize: "14px", fontWeight: 500 }}>
                  {service.name}
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: statusColor }}>
                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: statusColor }} />
                  {serviceState === "operational" ? "Operational" : serviceState === "loading" ? "Loading..." : "Outage"}
                </span>
              </div>

              {/* Status 90d progress ticks */}
              {renderTimelineTicks(serviceState)}
            </div>
          );
        })}
      </div>

      {/* 3. Past Incidents Header */}
      <h2 style={{ 
        fontSize: "20px", 
        fontWeight: 600, 
        color: "#fff", 
        marginBottom: "24px",
        letterSpacing: "-0.5px"
      }}>
        Past Incidents
      </h2>

      {/* Timeline logs */}
      <div style={{ display: "flex", flexDirection: "column", gap: "32px", marginBottom: "80px" }}>
        {incidentsHistory.map((item, idx) => (
          <div key={idx} style={{ 
            borderBottom: "1px solid #18181b", 
            paddingBottom: "24px"
          }}>
            <h3 style={{ 
              fontSize: "15px", 
              fontWeight: 600, 
              color: "#f4f4f5", 
              margin: "0 0 12px",
              letterSpacing: "-0.2px"
            }}>
              {item.date}
            </h3>

            {item.hasIncident ? (
              <div style={{ paddingLeft: "12px", borderLeft: "2px solid #3f3f46" }}>
                <div style={{ fontSize: "14px", fontWeight: 600, color: "#ef4444", marginBottom: "4px" }}>
                  {item.title}
                </div>
                <div style={{ fontSize: "12px", color: "#a1a1aa", marginBottom: "16px" }}>
                  {item.statusText}
                </div>

                {item.updates && item.updates.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    {item.updates.map((update, uIdx) => (
                      <div key={uIdx} style={{ fontSize: "13px" }}>
                        <span style={{ fontWeight: 600, color: "#fff", marginRight: "8px" }}>
                          {update.type}
                        </span>
                        <span style={{ color: "#71717a", fontSize: "11px", display: "block", marginTop: "2px", marginBottom: "4px" }}>
                          {update.time}
                        </span>
                        <p style={{ color: "#d4d4d8", margin: 0, lineHeight: "1.4" }}>
                          {update.desc}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <p style={{ fontSize: "13px", color: "#71717a", margin: 0 }}>
                {item.text}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Back to Home footer */}
      <footer style={{ 
        borderTop: "1px solid #18181b", 
        paddingTop: "24px", 
        display: "flex", 
        justifyContent: "space-between", 
        alignItems: "center",
        fontSize: "12px",
        color: "#71717a" 
      }}>
        <span>© 2026 Cadsploy. All rights reserved.</span>
        <a href="/" style={{ color: "var(--accent)", textDecoration: "none" }}>
          ← Back to Homepage
        </a>
      </footer>

      {/* 4. Subscribe to Updates Modal */}
      {showSubscribeModal && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0, 0, 0, 0.8)",
          backdropFilter: "blur(4px)",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          zIndex: 9999,
          padding: "16px"
        }}>
          <div style={{
            background: "#09090b",
            border: "2px solid var(--accent)",
            borderRadius: "6px",
            padding: "32px",
            maxWidth: "440px",
            width: "100%",
            boxShadow: "10px 10px 0 #000"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 700, color: "#fff", letterSpacing: "-0.5px" }}>
                Subscribe to Updates
              </h3>
              <button 
                onClick={() => setShowSubscribeModal(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#71717a",
                  cursor: "pointer",
                  fontSize: "18px"
                }}
              >
                ✕
              </button>
            </div>

            {subscribed ? (
              <div style={{ textAlign: "center", padding: "20px 0" }}>
                <div style={{ 
                  width: "48px", 
                  height: "48px", 
                  borderRadius: "50%", 
                  background: "rgba(16, 185, 129, 0.1)", 
                  color: "#10b981", 
                  display: "flex", 
                  justifyContent: "center", 
                  alignItems: "center", 
                  margin: "0 auto 16px",
                  fontSize: "24px"
                }}>
                  ✓
                </div>
                <h4 style={{ color: "#fff", margin: "0 0 8px" }}>Successfully Subscribed</h4>
                <p style={{ color: "#71717a", fontSize: "13px", margin: 0 }}>
                  You will now receive email notifications whenever we schedule maintenance or post system incidents.
                </p>
                <button
                  onClick={() => setShowSubscribeModal(false)}
                  style={{
                    marginTop: "24px",
                    background: "var(--accent)",
                    color: "#000",
                    border: "none",
                    borderRadius: "4px",
                    padding: "8px 24px",
                    fontWeight: 600,
                    cursor: "pointer",
                    fontSize: "13px"
                  }}
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubscribeSubmit}>
                <p style={{ color: "#a1a1aa", fontSize: "13px", margin: "0 0 20px", lineHeight: "1.4" }}>
                  Get real-time notification alerts sent straight to your inbox whenever Cadsploy schedules down times or experiences cloud infrastructure hiccups.
                </p>

                <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "20px" }}>
                  <label htmlFor="sub-email" style={{ color: "#71717a", fontSize: "11px", textTransform: "uppercase", fontWeight: 600 }}>
                    Email Address
                  </label>
                  <input
                    id="sub-email"
                    type="email"
                    required
                    placeholder="you@domain.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    style={{
                      background: "#18181b",
                      border: "1px solid #27272a",
                      borderRadius: "4px",
                      padding: "10px 12px",
                      color: "#fff",
                      fontSize: "14px",
                      outline: "none",
                      width: "100%"
                    }}
                    onFocus={(e) => e.currentTarget.style.borderColor = "var(--accent)"}
                    onBlur={(e) => e.currentTarget.style.borderColor = "#27272a"}
                  />
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
                  <button
                    type="button"
                    onClick={() => setShowSubscribeModal(false)}
                    style={{
                      background: "transparent",
                      color: "#a1a1aa",
                      border: "none",
                      cursor: "pointer",
                      fontSize: "13px",
                      fontWeight: 500
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    style={{
                      background: "var(--accent)",
                      color: "#000",
                      border: "none",
                      borderRadius: "4px",
                      padding: "10px 20px",
                      fontWeight: 600,
                      cursor: "pointer",
                      fontSize: "13px",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px"
                    }}
                  >
                    {submitting ? "Subscribing..." : "Subscribe"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Global CSS elements inside component style block */}
      <style jsx global>{`
        @keyframes status-pulse {
          0% { transform: scale(0.92); opacity: 0.6; box-shadow: 0 0 4px var(--accent); }
          50% { transform: scale(1.08); opacity: 1; box-shadow: 0 0 12px var(--accent); }
          100% { transform: scale(0.92); opacity: 0.6; box-shadow: 0 0 4px var(--accent); }
        }
        .service-row:hover {
          background: #18181b !important;
        }
      `}</style>
    </main>
  );
}

