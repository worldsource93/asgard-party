import multer from 'multer';
import sharp from 'sharp';
export const uploadVerification = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 2, fieldSize: 32, parts: 3 },
}).single('image');
export async function prepareImage(file) {
  const fail = message => Object.assign(new Error(message), { status: 400 });
  if (!file?.buffer?.length) throw fail('인증 이미지를 첨부해 주세요.');
  let image;
  try {
    const input = sharp(file.buffer, { limitInputPixels: 25000000, failOn: 'error' });
    const metadata = await input.metadata();
    if (!['jpeg', 'png', 'webp'].includes(metadata.format) || (metadata.pages || 1) > 1) throw new Error('format');
    image = await input.rotate().resize({ width: 2560, height: 2560, fit: 'inside', withoutEnlargement: true }).webp({ quality: 90 }).toBuffer();
  } catch { throw fail('정상적인 JPG·PNG·WebP 정지 이미지를 첨부해 주세요. (최대 2,500만 화소)'); }
  if (image.length > 1500000) throw fail('이미지가 너무 큽니다. 인증에 필요한 화면만 잘라 다시 첨부해 주세요.');
  return image;
}
