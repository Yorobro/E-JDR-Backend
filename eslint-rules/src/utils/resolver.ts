import fs from "fs";
import path from "path";

type TsConfigPaths = Record<string, string[]>;

let cachedPaths: { baseUrl: string; paths: TsConfigPaths } | null = null;

function loadTsConfig(projectRoot: string) {
  if (cachedPaths) return cachedPaths;
  try {
    const cfgPath = path.resolve(projectRoot, "tsconfig.json");
    const raw = fs.readFileSync(cfgPath, "utf8");
    const parsed = JSON.parse(raw);
    const compilerOptions = parsed.compilerOptions || {};
    const baseUrl = compilerOptions.baseUrl || ".";
    const paths: TsConfigPaths = compilerOptions.paths || {};
    cachedPaths = { baseUrl, paths };
    return cachedPaths;
  } catch (err) {
    cachedPaths = { baseUrl: ".", paths: {} };
    return cachedPaths;
  }
}

function tryResolveWithExtensions(base: string) {
  const exts = [".ts", ".tsx", ".js", ".jsx", ".d.ts", "/index.ts", "/index.js"];
  for (const ext of exts) {
    const candidate = base.endsWith(ext) ? base : base + ext;
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

export function resolveImport(
  importSource: string,
  contextFile: string,
  projectRoot = process.cwd(),
): string | null {
  if (!importSource) return null;

  // Absolute / package imports — ignore
  if (!importSource.startsWith(".") && !importSource.startsWith("@")) return null;

  // Relative imports
  if (importSource.startsWith(".")) {
    const resolved = path.resolve(path.dirname(contextFile), importSource);
    const r = tryResolveWithExtensions(resolved) || resolved;
    return path.normalize(r);
  }

  // Aliased imports starting with @
  const { baseUrl, paths } = loadTsConfig(projectRoot);
  for (const key of Object.keys(paths)) {
    // key like '@domain/*' or '@app/*'
    if (key.endsWith("/*")) {
      const prefix = key.slice(0, -2);
      if (importSource.startsWith(prefix + "/") || importSource === prefix) {
        const rest = importSource === prefix ? "" : importSource.slice(prefix.length + 1);
        const targetPatterns = paths[key];
        if (!targetPatterns || targetPatterns.length === 0) continue;
        // take first pattern
        const pattern = targetPatterns[0]; // e.g. 'src/domain/*'
        const target = pattern.replace("*", rest);
        const abs = path.resolve(projectRoot, baseUrl, target);
        const r = tryResolveWithExtensions(abs) || abs;
        return path.normalize(r);
      }
    } else {
      // exact alias
      if (importSource === key || importSource.startsWith(key + "/")) {
        const rest = importSource === key ? "" : importSource.slice(key.length + 1);
        const targetPatterns = paths[key];
        if (!targetPatterns || targetPatterns.length === 0) continue;
        const pattern = targetPatterns[0];
        const target = pattern.endsWith("/*") ? pattern.replace("*", rest) : pattern;
        const abs = path.resolve(projectRoot, baseUrl, target);
        const r = tryResolveWithExtensions(abs) || abs;
        return path.normalize(r);
      }
    }
  }

  return null;
}
