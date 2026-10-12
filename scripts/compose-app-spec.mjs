#!/usr/bin/env node
/**
 * Merge parent .do/base.yaml with each submodule's .do/component.yaml
 * into .do/app.yaml (the App Platform create/update source of truth).
 *
 * Fragment keys merged from components: services, static_sites, jobs, databases,
 * workers, functions. (mars-demo-db owns databases + db-migrate job.)
 * Parent base owns: name, region, features, alerts, ingress, …
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const checkOnly = process.argv.includes("--check");

const COMPONENT_KEYS = [
  "services",
  "static_sites",
  "jobs",
  "databases",
  "workers",
  "functions",
];

const SUBMODULES = [
  "components/mars-demo-ui",
  "components/mars-demo-api",
  "components/mars-demo-db",
];

function loadYaml(path) {
  if (!existsSync(path)) {
    throw new Error(`missing YAML: ${path}`);
  }
  return yaml.load(readFileSync(path, "utf8")) || {};
}

function compose() {
  const basePath = join(root, ".do", "base.yaml");
  const outPath = join(root, ".do", "app.yaml");
  const composed = { ...loadYaml(basePath) };

  for (const key of COMPONENT_KEYS) {
    if (Array.isArray(composed[key])) {
      // Parent may seed empty arrays; fragments append.
      composed[key] = [...composed[key]];
    }
  }

  for (const sub of SUBMODULES) {
    const fragPath = join(root, sub, ".do", "component.yaml");
    if (!existsSync(fragPath)) {
      throw new Error(
        `submodule fragment missing: ${fragPath} (run git submodule update --init)`,
      );
    }
    const frag = loadYaml(fragPath);
    for (const key of COMPONENT_KEYS) {
      if (frag[key] == null) continue;
      if (!Array.isArray(frag[key])) {
        throw new Error(`${fragPath}: ${key} must be an array`);
      }
      composed[key] = [...(composed[key] || []), ...frag[key]];
    }
    // Reject unknown top-level keys that would silently drop parent ownership.
    for (const key of Object.keys(frag)) {
      if (COMPONENT_KEYS.includes(key)) continue;
      throw new Error(
        `${fragPath}: unsupported key "${key}" (parent owns non-component keys in .do/base.yaml)`,
      );
    }
  }

  const header = [
    "# GENERATED FILE — do not edit by hand.",
    "# Source: .do/base.yaml + components/*/.do/component.yaml",
    "# Regenerate: npm run compose",
    "",
  ].join("\n");

  const body = yaml.dump(composed, {
    lineWidth: 100,
    noRefs: true,
    sortingKeys: false,
  });
  const next = header + body;

  if (checkOnly) {
    if (!existsSync(outPath)) {
      console.error("compose-app-spec: .do/app.yaml missing");
      process.exit(1);
    }
    const prev = readFileSync(outPath, "utf8");
    if (prev !== next) {
      console.error(
        "compose-app-spec: .do/app.yaml is stale; run npm run compose",
      );
      process.exit(1);
    }
    console.log("compose-app-spec: .do/app.yaml up to date");
    return;
  }

  writeFileSync(outPath, next);
  console.log(`compose-app-spec: wrote ${outPath}`);
}

compose();
