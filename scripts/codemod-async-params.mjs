#!/usr/bin/env node
/**
 * Codemod: Next.js async route params (params is a Promise).
 */
import fs from "fs";
import path from "path";

const APP = path.join(process.cwd(), "src/app");

function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (/\.(tsx|ts)$/.test(e.name)) out.push(p);
  }
  return out;
}

/** Wrap `params: { ... }` type annotations in Promise (not destructuring). */
function wrapParamTypes(src) {
  return src.replace(/params:\s*(\{[^{}]+\})/g, (match, obj, idx) => {
    const before = src.slice(Math.max(0, idx - 12), idx);
    if (before.endsWith("Promise<")) return match;
    if (!obj.includes(":")) return match;
    if (match.includes("Promise<")) return match;
    return `params: Promise<${obj}>`;
  });
}

function extractParamNames(destructure) {
  return destructure
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function fixFile(filePath) {
  let src = fs.readFileSync(filePath, "utf8");
  const orig = src;

  src = wrapParamTypes(src);

  src = src.replace(
    /export default async function (\w+)\(\{\s*params:\s*\{([^}]*)\}\s*\}:\s*\{[^)]+\)\s*\{/g,
    (full, _name, names) => {
      const keys = extractParamNames(names);
      if (!keys.length) return full;
      const awaitLine = `  const { ${keys.join(", ")} } = await params;\n`;
      const fixed = full.replace(/params:\s*\{[^}]*\}/, "params");
      if (fixed.includes(awaitLine.trim())) return fixed;
      return fixed.replace(/\{\s*$/, `{\n${awaitLine}`);
    }
  );

  src = src.replace(
    /export async function generateMetadata\(\{\s*params:\s*\{([^}]*)\}\s*\}:\s*\{[^)]+\)\s*\{/g,
    (full, names) => {
      const keys = extractParamNames(names);
      if (!keys.length) return full;
      const awaitLine = `  const { ${keys.join(", ")} } = await params;\n`;
      const fixed = full.replace(/params:\s*\{[^}]*\}/, "params");
      if (fixed.includes(awaitLine.trim())) return fixed;
      return fixed.replace(/\{\s*$/, `{\n${awaitLine}`);
    }
  );

  src = src.replace(
    /export async function generateMetadata\(\{\s*params,\s*\}:\s*\{[^)]+\)\s*\{(?!\s*const\s+\{)/g,
    (full) => {
      const typeMatch = full.match(/params:\s*Promise<\{([^}]+)\}>/);
      if (!typeMatch) return full;
      const keys = typeMatch[1]
        .split(";")
        .map((p) => p.split(":")[0]?.trim())
        .filter(Boolean);
      if (!keys.length) return full;
      return full.replace(/\{\s*$/, `{\n  const { ${keys.join(", ")} } = await params;\n`);
    }
  );

  src = src.replace(
    /export default async function (\w+)\(\{\s*([^}]*),\s*params:\s*\{([^}]*)\}\s*\}:\s*\{[^)]+\)\s*\{/g,
    (full, _name, beforeParams, names) => {
      const keys = extractParamNames(names);
      if (!keys.length) return full;
      const awaitLine = `  const { ${keys.join(", ")} } = await params;\n`;
      const fixed = full.replace(/,\s*params:\s*\{[^}]*\}/, ", params");
      if (fixed.includes(awaitLine.trim())) return fixed;
      return fixed.replace(/\{\s*$/, `{\n${awaitLine}`);
    }
  );

  src = src.replace(
    /export default async function (\w+)\(\{\s*params,\s*([^}]*)\}:\s*\{[^)]+\)\s*\{/g,
    (full, _name, after) => {
      const typeMatch = src.match(
        new RegExp(
          `export default async function ${_name}[\\s\\S]*?params:\\s*Promise<\\{([^}]+)\\}>`
        )
      );
      if (!typeMatch) return full;
      const keys = typeMatch[1]
        .split(";")
        .map((p) => p.split(":")[0]?.trim())
        .filter(Boolean);
      if (!keys.length) return full;
      const awaitLine = `  const { ${keys.join(", ")} } = await params;\n`;
      if (full.includes(awaitLine.trim())) return full;
      return full.replace(/\{\s*$/, `{\n${awaitLine}`);
    }
  );

  src = src.replace(
    /export async function (\w+)\(\s*\n\s*\{\s*params\s*\}:\s*\{\s*params:\s*Promise<\{([^}]+)\}>\s*\}\s*\)\s*\{(?!\s*const\s+\{)/g,
    (full, _name, typeInner) => {
      const keys = typeInner
        .split(";")
        .map((p) => p.split(":")[0]?.trim())
        .filter(Boolean);
      if (!keys.length) return full;
      return full.replace(/\{\s*$/, `{\n  const { ${keys.join(", ")} } = await params;\n`);
    }
  );

  src = src.replace(
    /export async function (\w+)\(\{\s*params\s*\}:\s*\{\s*params:\s*Promise<\{([^}]+)\}>\s*\}\)\s*\{(?!\s*const\s+\{)/g,
    (full, _name, typeInner) => {
      const keys = typeInner
        .split(";")
        .map((p) => p.split(":")[0]?.trim())
        .filter(Boolean);
      if (!keys.length) return full;
      return full.replace(/\{\s*$/, `{\n  const { ${keys.join(", ")} } = await params;\n`);
    }
  );

  if (src !== orig) {
    fs.writeFileSync(filePath, src);
    return true;
  }
  return false;
}

const files = walk(APP);
let n = 0;
for (const f of files) {
  if (fixFile(f)) {
    n++;
    console.log("fixed:", path.relative(process.cwd(), f));
  }
}
console.log(`Done. ${n}/${files.length} files updated.`);
