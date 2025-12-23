import fs from "node:fs";
import os from "node:os";

// 箇条書きブロックを書き出す小ヘルパー
function writeList(ws, title, arr) {
  ws.write(`### ${title}` + os.EOL);
  ws.write(os.EOL);
  if (!arr || arr.length === 0) {
    ws.write("- (none)" + os.EOL + os.EOL);
    return;
  }
  for (const item of arr) ws.write(`- ${item}` + os.EOL);
  ws.write(os.EOL);
}

// レビュー用 Markdown を生成
export async function writeReviewFile(reviewItems, { filePath, root, outFile }) {
  const ws = fs.createWriteStream(filePath, { encoding: "utf8" });
  const w = (line = "") => ws.write(line + os.EOL);

  w("# Review - Third-Party Notices (NuGet)");
  w("");
  if (root) w(`Project root: ${root}`);
  if (outFile) w(`Notices file: ${outFile}`);
  w("");
  w("## Items to verify");
  w("");

  for (const item of reviewItems) {
    w(`### ${item.key}`);
    if (item.anchor) w(`Anchor: #${item.anchor}`);
    if (item.status) w(`Status: ${item.status}`);
    if (item.source) w(item.source);
    if (item.licenseLine) w(item.licenseLine);
    if (item.files && item.files.length > 0) {
      w("Files:");
      for (const f of item.files) w(`- ${f}`);
    }
    if (item.flags && item.flags.length > 0) {
      w("Flags:");
      for (const f of item.flags) w(`- ${f}`);
    }
    w("");
  }

  await new Promise((resolve) => ws.end(resolve));
}
