import { spawn } from "node:child_process";
import type { LogStream } from "@prisma/client";

type RunOptions = {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  onLog?: (line: string, stream: LogStream) => Promise<void> | void;
  timeoutMs?: number;
};

export function runCommand(command: string, args: string[], options: RunOptions = {}): Promise<void> {
  return new Promise((resolve, reject) => {
    let cmd = command;
    let cmdArgs = [...args];
    const spawnEnv = { ...process.env, ...options.env };

    if (process.platform === "win32" && (command === "docker" || command === "nixpacks")) {
      cmd = "wsl";
      const wslArgs: string[] = [];
      if (options.cwd) {
        wslArgs.push("--cd", options.cwd);
      }
      wslArgs.push(command, ...args);
      cmdArgs = wslArgs;

      if (options.env && Object.keys(options.env).length > 0) {
        const keys = Object.keys(options.env);
        const existingWslEnv = process.env.WSLENV || "";
        const newWslEnv = [
          ...existingWslEnv.split(":").filter(Boolean),
          ...keys
        ].join(":");
        spawnEnv.WSLENV = newWslEnv;
      }
    }

    const child = spawn(cmd, cmdArgs, {
      cwd: options.cwd,
      env: spawnEnv,
      shell: false,
    });

    let stdoutBuffer = "";
    let stderrBuffer = "";
    let timedOut = false;

    const timer = options.timeoutMs
      ? setTimeout(() => {
          timedOut = true;
          child.kill("SIGTERM");
        }, options.timeoutMs)
      : null;

    const flush = (buffer: string, stream: LogStream) => {
      const lines = buffer.split(/\r?\n/);
      const rest = lines.pop() ?? "";
      for (const line of lines) {
        if (line.trim().length > 0) void options.onLog?.(line, stream);
      }
      return rest;
    };

    child.stdout.on("data", (chunk) => {
      stdoutBuffer += chunk.toString();
      stdoutBuffer = flush(stdoutBuffer, "stdout");
    });

    child.stderr.on("data", (chunk) => {
      stderrBuffer += chunk.toString();
      stderrBuffer = flush(stderrBuffer, "stderr");
    });

    child.on("error", (error) => {
      if (timer) clearTimeout(timer);
      reject(error);
    });

    child.on("close", (code) => {
      if (timer) clearTimeout(timer);
      if (stdoutBuffer.trim()) void options.onLog?.(stdoutBuffer.trim(), "stdout");
      if (stderrBuffer.trim()) void options.onLog?.(stderrBuffer.trim(), "stderr");
      if (timedOut) return reject(new Error(`${command} timed out`));
      if (code === 0) return resolve();
      reject(new Error(`${command} exited with code ${code}`));
    });
  });
}
