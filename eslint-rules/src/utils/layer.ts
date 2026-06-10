import path from "path";

export type Layer =
  | "domain"
  | "application"
  | "infrastructure"
  | "presentation"
  | "config"
  | "unknown";

export function detectLayer(filePath: string, projectRoot = process.cwd()): Layer {
  if (!filePath) return "unknown";
  const rel = path.relative(projectRoot, filePath).replace(/\\/g, "/");

  if (rel.startsWith("src/domain/")) return "domain";
  if (rel.startsWith("src/application/")) return "application";
  if (rel.startsWith("src/infrastructure/")) return "infrastructure";
  if (rel.startsWith("src/presentation/")) return "presentation";
  if (rel.startsWith("src/config/")) return "config";

  // also handle barrel files like src/domain.ts or files directly under src/domain
  if (rel.includes("/domain/")) return "domain";
  if (rel.includes("/application/")) return "application";
  if (rel.includes("/infrastructure/")) return "infrastructure";
  if (rel.includes("/presentation/")) return "presentation";
  if (rel.includes("/config/")) return "config";

  return "unknown";
}
