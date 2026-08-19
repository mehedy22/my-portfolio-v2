/**
 * The upload allow-list (NFR-06, D-018). A file is accepted only if its *content* matches one of
 * these signatures — the client-supplied `Content-Type` and the filename extension are both
 * trivially spoofable and are never trusted.
 *
 * <p>SVG is deliberately absent: it is XML that can carry `<script>`, so serving one inline from
 * the API's own origin would be a stored-XSS vector.
 */
export type AllowedFileType = {
  mimeType: string;
  extension: string;
  isImage: boolean;
  signature: number[];
  /** RIFF alone is also AVI/WAV; only the WEBP marker at offset 8 makes it an image we accept. */
  markerAtOffset?: { offset: number; bytes: number[] };
};

const TYPES: AllowedFileType[] = [
  { mimeType: "image/jpeg", extension: "jpg", isImage: true, signature: [0xff, 0xd8, 0xff] },
  {
    mimeType: "image/png",
    extension: "png",
    isImage: true,
    signature: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  },
  { mimeType: "image/gif", extension: "gif", isImage: true, signature: [0x47, 0x49, 0x46, 0x38] },
  { mimeType: "application/pdf", extension: "pdf", isImage: false, signature: [0x25, 0x50, 0x44, 0x46, 0x2d] },
  {
    mimeType: "image/webp",
    extension: "webp",
    isImage: true,
    signature: [0x52, 0x49, 0x46, 0x46],
    markerAtOffset: { offset: 8, bytes: [0x57, 0x45, 0x42, 0x50] },
  },
];

/**
 * The detected type, or null. This is an allow-list, not a classifier: an unrecognised file is
 * rejected rather than guessed at, which is what makes a renamed `.php` fail closed.
 */
export function detectFileType(content: Buffer): AllowedFileType | null {
  if (!content?.length) return null;
  return (
    TYPES.find((type) => {
      if (!startsWith(content, type.signature, 0)) return false;
      if (!type.markerAtOffset) return true;
      return startsWith(content, type.markerAtOffset.bytes, type.markerAtOffset.offset);
    }) ?? null
  );
}

function startsWith(content: Buffer, expected: number[], offset: number): boolean {
  if (content.length < offset + expected.length) return false;
  return expected.every((byte, index) => content[offset + index] === byte);
}

/**
 * Pixel dimensions read from the header bytes, for the formats whose headers are trivial to parse.
 * WebP is not attempted, matching the Java service, where ImageIO has no WebP reader — the columns
 * are nullable precisely because this is best-effort.
 */
export function readDimensions(content: Buffer, type: AllowedFileType): { width: number; height: number } | null {
  try {
    if (type.mimeType === "image/png" && content.length > 24) {
      return { width: content.readUInt32BE(16), height: content.readUInt32BE(20) };
    }
    if (type.mimeType === "image/gif" && content.length > 10) {
      return { width: content.readUInt16LE(6), height: content.readUInt16LE(8) };
    }
    if (type.mimeType === "image/jpeg") return readJpegDimensions(content);
    return null;
  } catch {
    return null;
  }
}

/** JPEG stores size in a start-of-frame segment, which has to be walked to. */
function readJpegDimensions(content: Buffer): { width: number; height: number } | null {
  let offset = 2;
  while (offset + 9 < content.length) {
    if (content[offset] !== 0xff) return null;
    const marker = content[offset + 1]!;
    const length = content.readUInt16BE(offset + 2);
    // SOF0..SOF15, excluding the non-frame markers in that range.
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { height: content.readUInt16BE(offset + 5), width: content.readUInt16BE(offset + 7) };
    }
    offset += 2 + length;
  }
  return null;
}
