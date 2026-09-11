export const BINARY_EXTENSIONS = new Set([
  'pdf', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'ico', 'svg', 'bmp', 'tiff',
  'exe', 'dll', 'bin', 'zip', 'tar', 'gz', '7z', 'rar', 'iso', 'dmg',
  'mp3', 'mp4', 'wav', 'ogg', 'mkv', 'avi', 'mov', 'webm',
  'woff', 'woff2', 'ttf', 'eot', 'otf',
  'docx', 'xlsx', 'pptx', 'doc', 'xls', 'ppt',
  'wasm', 'pyc', 'class', 'o', 'obj', 'so', 'dylib'
]);

export function getFileType(filePath: string): 'pdf' | 'image' | 'binary' | 'text' {
  if (!filePath || typeof filePath !== 'string') return 'text';
  const ext = (filePath.split('.').pop() || '').toLowerCase();
  if (ext === 'pdf') return 'pdf';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'ico', 'svg', 'bmp'].includes(ext)) return 'image';
  if (BINARY_EXTENSIONS.has(ext)) return 'binary';
  return 'text';
}
