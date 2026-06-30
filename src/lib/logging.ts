type LogLevel = "info" | "warn" | "error";

function log(level: LogLevel, message: string, data?: unknown): void {
  const timestamp = new Date().toISOString();
  const prefix = `[${level.toUpperCase()}] ${timestamp}`;

  switch (level) {
    case "info":
      console.log(`${prefix} ${message}`, data ?? "");
      break;
    case "warn":
      console.warn(`${prefix} ${message}`, data ?? "");
      break;
    case "error":
      console.error(`${prefix} ${message}`, data ?? "");
      break;
  }

  if (process.env.NODE_ENV === "production") {
    fetch("/api/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ level, message, data, timestamp }),
    }).catch(() => {});
  }
}

export const logger = {
  info: (message: string, data?: unknown) => log("info", message, data),
  warn: (message: string, data?: unknown) => log("warn", message, data),
  error: (message: string, data?: unknown) => log("error", message, data),
};
