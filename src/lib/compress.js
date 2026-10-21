// 浏览器端图片压缩封装，供上传页"压缩上传"模式使用。
// 等效 picgo-plugin-squeeze 的本地压缩行为：质量压缩 + 尺寸限制，压大时保留原图。
// 默认输出 WebP 格式（体积最小），转换时同步修改文件名后缀。
import imageCompression from 'browser-image-compression';

const MAX_SIZE_MB = 1; // 目标体积上限
const MAX_DIMENSION = 1920; // 长边上限
const SKIP_THRESHOLD = 100 * 1024; // 小于 100KB 不压缩

const EXT_BY_TYPE = {
  'image/webp': '.webp',
  'image/jpeg': '.jpg',
  'image/png': '.png',
};

export async function compressImage(file, { quality = 0.8, format = 'image/webp' } = {}) {
  // GIF 压缩会丢动画帧，跳过（保留原样上传）
  if (file.type === 'image/gif') return file;
  // 已经很小的文件无需压缩
  if (file.size <= SKIP_THRESHOLD) return file;

  try {
    let compressed = await imageCompression(file, {
      maxSizeMB: MAX_SIZE_MB,
      maxWidthOrHeight: MAX_DIMENSION,
      initialQuality: quality,
      useWebWorker: true,
      fileType: format,
    });
    // 压缩后反而变大则保留原图
    if (compressed.size >= file.size) return file;

    // 转换了格式时同步修改文件名后缀，保持 name 与 type 一致
    const ext = EXT_BY_TYPE[format];
    if (ext && format !== file.type && !compressed.name.toLowerCase().endsWith(ext)) {
      const base = compressed.name.replace(/\.[^.]+$/, '');
      compressed = new File([compressed], base + ext, { type: format });
    }
    return compressed;
  } catch (error) {
    console.warn(`压缩 ${file.name} 失败，使用原图上传:`, error);
    return file;
  }
}
