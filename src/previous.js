import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

// 既存の notices を安全にパース（行頭 "## " を境界に、アンカー除去、キーは id@version を小文字化）
export function loadPreviousSections(filePath, warn) {
  const map = new Map();
  if (!fs.existsSync(filePath)) return { sections: map, carriedTag: null };

  const content = fs.readFileSync(filePath, "utf8");
  const carriedTag = `${path.basename(filePath)} (sha256:${crypto.createHash("sha256").update(content).digest("hex").slice(0, 8)})`;
  const lines = content.split(/\r?\n/);

  let title = null;
  let buf = [];
  const flush = () => {
    if (!title) return;
    const bodyLines = buf.filter((l) => !l.startsWith("<a id=")); // 旧アンカーは除去
    const body = bodyLines.join("\n");
    const keyMatch = title.match(/(.+?)@(.+)/);
    if (!keyMatch) {
      warn?.(`Skipping previous section with unparsable title: "${title}"`);
      return;
    }
    const keyLower = `${keyMatch[1].toLowerCase()}@${keyMatch[2]}`;
    map.set(keyLower, { title, body });
  };

  for (const line of lines) {
    if (line.startsWith("## ")) {
      flush();
      title = line.slice(3).trim();
      buf = [];
    } else if (title) {
      buf.push(line);
    }
  }
  flush();

  return { sections: map, carriedTag };
}
