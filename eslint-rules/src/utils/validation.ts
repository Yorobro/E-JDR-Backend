import { Layer } from "./layer";

const allowedDeps: Record<Layer, Layer[]> = {
  domain: ["domain"],
  application: ["application", "domain"],
  infrastructure: ["infrastructure", "application", "domain"],
  presentation: ["presentation", "application"],
  config: ["config", "application", "infrastructure", "presentation", "domain"],
  unknown: ["domain", "application", "infrastructure", "presentation", "config", "unknown"],
};

export function isDependencyAllowed(from: Layer, to: Layer): boolean {
  const allowed = allowedDeps[from] || [];
  return allowed.includes(to);
}

export function allowedFor(from: Layer): Layer[] {
  return allowedDeps[from] || [];
}
