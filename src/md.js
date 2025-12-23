// Markdown コードフェンス内で ``` が壊れないようにエスケープ
export function mdCodeFenceText(s) {
  return String(s).replace(/```/g, "``\u200b`");
}

// 重複排除してソート
export function uniqSorted(arr) {
  return [...new Set(arr)].sort();
}

// 見出し用アンカーをパッケージ名から生成
export function makeAnchorId(key) {
  return (
    "pkg-" +
    String(key)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
  );
}
