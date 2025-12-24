import { readFile } from "node:fs/promises";
import { decodeSmart } from "./encoding.js";

const ENTITY_MAP = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
};

function decodeEntities(str) {
  return String(str).replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (m, p1) => {
    if (p1[0] === "#") {
      const code = p1[1].toLowerCase() === "x" ? parseInt(p1.slice(2), 16) : parseInt(p1.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return ENTITY_MAP[p1] ?? m;
  });
}

function getTagInner(xml, tag) {
  const re = new RegExp(`<(?:[\\w.:-]+:)?${tag}(\\s[^>]*)?>([\\s\\S]*?)<\\/(?:[\\w.:-]+:)?${tag}>`, "i");
  const m = xml.match(re);
  return m ? { attrs: m[1] || "", text: m[2] } : null;
}

function getSelfClosingTagAttrs(xml, tag) {
  const re = new RegExp(`<(?:[\\w.:-]+:)?${tag}(\\s[^>]*?)\\/?>`, "i");
  const m = xml.match(re);
  return m ? m[1] || "" : null;
}

function parseAttrs(attrText) {
  const attrs = {};
  if (!attrText) return attrs;
  const re = /([\w.:-]+)\s*=\s*"(.*?)"/g;
  let m;
  while ((m = re.exec(attrText))) {
    attrs[m[1]] = decodeEntities(m[2]);
  }
  return attrs;
}

// nuspec から必要なメタデータだけを簡易抽出
export async function readNuspecMetadata(nuspecPath) {
  const result = {
    id: null,
    version: null,
    licenseText: null,
    licenseType: null,
    licenseUrl: null,
    projectUrl: null,
    repoUrl: null,
    description: null,
    raw: null,
  };

  try {
    const raw = await readFile(nuspecPath);
    const xml = decodeSmart(raw);
    const metaBlock = getTagInner(xml, "metadata")?.text ?? xml;

    const id = getTagInner(metaBlock, "id")?.text;
    const version = getTagInner(metaBlock, "version")?.text;
    if (id) result.id = decodeEntities(id.trim());
    if (version) result.version = decodeEntities(version.trim());

    const license = getTagInner(metaBlock, "license");
    if (license) {
      const attrs = parseAttrs(license.attrs);
      result.licenseType = attrs.type ?? null;
      result.licenseText = decodeEntities((license.text || "").trim());
    }
    const licenseUrl = getTagInner(metaBlock, "licenseUrl")?.text;
    if (licenseUrl) result.licenseUrl = decodeEntities(licenseUrl.trim());

    const projectUrl = getTagInner(metaBlock, "projectUrl")?.text;
    if (projectUrl) result.projectUrl = decodeEntities(projectUrl.trim());

    const description = getTagInner(metaBlock, "description")?.text;
    if (description) result.description = decodeEntities(description.trim());

    const repoAttrsText = getSelfClosingTagAttrs(metaBlock, "repository");
    const repoAttrs = parseAttrs(repoAttrsText);
    if (repoAttrs.url) result.repoUrl = repoAttrs.url;

    result.raw = metaBlock;
  } catch {
    // ignore parse errors; caller can use defaults
  }

  return result;
}
