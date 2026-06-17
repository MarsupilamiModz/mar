#!/usr/bin/env node
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

function keysFromPromiseType(src, fnStart) {
  const slice = src.slice(fnStart, fnStart + 800);
  const m = slice.match(/params:\s*Promise<\{([^}]+)\}>/);
  if (!m) return null;
  return m[1]
    .split(";")
    .map((p) => p.split(":")[0]?.trim())
    .filter(Boolean);
}

function fixFile(filePath) {
  let src = fs.readFileSync(filePath, "utf8");
  const orig = src;

  src = src.replace(/\n(\s*)params:\s*\{([^}]+)\},/g, "\n$1params,");

  src = src.replace(
    /export default function (\w+)\(\{\s*params:\s*\{([^}]+)\}\s*\}/g,
    "export default async function $1({ params }"
  );

  src = src.replace(
    /export default async function (\w+)\(\{\s*params:\s*\{([^}]+)\}\s*\}/g,
    "export default async function $1({ params }"
  );

  const fnRe = /export (?:default )?async function \w+\([^)]*\)\s*\{/g;
  let match;
  const inserts = [];
  while ((match = fnRe.exec(src)) !== null) {
    const fnStart = match.index;
    const bodyStart = match.index + match[0].length;
    const afterBrace = src.slice(bodyStart, bodyStart + 80);
    if (/^\s*const\s+\{[^}]+\}\s*=\s*await params/.test(afterBrace)) continue;
    if (!src.slice(fnStart, bodyStart + 200).includes("params: Promise<")) continue;

    const keys = keysFromPromiseType(src, fnStart);
    if (!keys?.length) continue;

    const indent = (afterBrace.match(/^\s*/) ?? ["  "])[0] || "  ";
    inserts.push({
      pos: bodyStart,
      line: `${indent}const { ${keys.join(", ")} } = await params;\n`,
    });
  }

  for (const ins of inserts.sort((a, b) => b.pos - a.pos)) {
    src = src.slice(0, ins.pos) + ins.line + src.slice(ins.pos);
  }

  const routeFnRe = /export async function (GET|POST|PUT|PATCH|DELETE)\([^)]*\)\s*\{/g;
  while ((match = routeFnRe.exec(src)) !== null) {
    const fnStart = match.index;
    const bodyStart = match.index + match[0].length;
    const afterBrace = src.slice(bodyStart, bodyStart + 80);
    if (/^\s*const\s+\{[^}]+\}\s*=\s*await params/.test(afterBrace)) continue;
    if (!src.slice(fnStart, bodyStart + 200).includes("params: Promise<")) continue;
    const keys = keysFromPromiseType(src, fnStart);
    if (!keys?.length) continue;
    const indent = "  ";
    src = src.slice(0, bodyStart) + `${indent}const { ${keys.join(", ")} } = await params;\n` + src.slice(bodyStart);
  }

  if (src !== orig) {
    fs.writeFileSync(filePath, src);
    return true;
  }
  return false;
}

let n = 0;
for (const f of walk(APP)) {
  if (fixFile(f)) {
    n++;
    console.log("fixed:", path.relative(process.cwd(), f));
  }
}
console.log(`Pass 2 done: ${n} files`);
