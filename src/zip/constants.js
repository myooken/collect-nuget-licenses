// ZIP constants and regex
export const SIG_EOCD = 0x06054b50; // End of central directory
export const SIG_Z64_LOC = 0x07064b50; // Zip64 EOCD locator
export const SIG_Z64_EOCD = 0x06064b50; // Zip64 EOCD record
export const SIG_CEN = 0x02014b50; // Central directory header
export const SIG_LOC = 0x04034b50; // Local file header

export const MAX_COMMENT = 0xffff;
export const MAX_SAFE_BIG = BigInt(Number.MAX_SAFE_INTEGER);

// LICENSE-like basename match
export const LICENSE_BASENAME_RE = /^(LICEN[CS]E|COPYING|NOTICE)([\.-].*)?$/i;
