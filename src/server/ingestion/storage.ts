import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';
import { AppError, assert } from '../core';
export const sha256 = (data: Buffer | string) => createHash('sha256').update(data).digest('hex');
function localPath(key: string) {
  assert(/^[a-f0-9-]+\/[a-f0-9-]+$/.test(key), 'Invalid object key.');
  return path.resolve(
    /* turbopackIgnore: true */ process.env.LOCAL_DATA_DIR || '.data',
    'objects',
    key,
  );
}
function s3() {
  assert(process.env.S3_BUCKET, 'S3_BUCKET is required.');
  return new S3Client({
    region: process.env.S3_REGION || 'ap-southeast-1',
    endpoint: process.env.S3_ENDPOINT || undefined,
    forcePathStyle: !!process.env.S3_ENDPOINT,
  });
}
export async function storeOriginal(companyId: string, data: Buffer, mime: string) {
  const key = `${companyId}/${randomUUID()}`;
  if (process.env.STORAGE_PROVIDER === 's3')
    await s3().send(
      new PutObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: key,
        Body: data,
        ContentType: mime,
        // Supabase encrypts storage at rest but does not implement the AWS SSE header.
        ServerSideEncryption: process.env.S3_ENDPOINT?.includes('.supabase.')
          ? undefined
          : 'AES256',
        IfNoneMatch: '*',
      }),
    );
  else {
    assert(
      process.env.DATABASE_MODE === 'local' || process.env.NODE_ENV !== 'production',
      'Production requires private object storage.',
    );
    const dest = localPath(key);
    await mkdir(path.dirname(dest), { recursive: true });
    await writeFile(dest, data, { flag: 'wx' });
  }
  return key;
}
export async function readOriginal(key: string) {
  if (process.env.STORAGE_PROVIDER === 's3') {
    const result = await s3().send(
      new GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key }),
    );
    assert(result.Body, 'Document is unavailable.', 404);
    return Buffer.from(await result.Body.transformToByteArray());
  }
  return readFile(localPath(key));
}
export function inspectFile(data: Buffer, name: string, statement = false) {
  assert(
    data.length > 0 && data.length <= 20 * 1024 * 1024,
    'Each file must be between 1 byte and 20 MB.',
  );
  const ext = path.extname(name).toLowerCase();
  if (ext === '.pdf' && data.subarray(0, 5).toString() === '%PDF-') return 'application/pdf';
  if (
    !statement &&
    ['.jpg', '.jpeg'].includes(ext) &&
    data[0] === 255 &&
    data[1] === 216 &&
    data[2] === 255
  )
    return 'image/jpeg';
  if (
    !statement &&
    ext === '.png' &&
    data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    return 'image/png';
  if (statement && ext === '.csv' && !data.includes(0)) return 'text/csv';
  if (statement && ext === '.xlsx' && data.subarray(0, 4).equals(Buffer.from([80, 75, 3, 4])))
    return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  throw new AppError(
    400,
    statement
      ? 'Use a valid PDF, CSV or XLSX bank statement.'
      : 'Use a valid PDF, JPG, JPEG or PNG document.',
  );
}
export async function imageFingerprint(data: Buffer, mime: string) {
  if (!mime.startsWith('image/')) return null;
  const pixels = await sharp(data, { limitInputPixels: 40_000_000 })
    .rotate()
    .resize(9, 8, { fit: 'fill' })
    .greyscale()
    .raw()
    .toBuffer();
  let bits = 0n;
  for (let y = 0; y < 8; y++)
    for (let x = 0; x < 8; x++)
      bits = (bits << 1n) | (pixels[y * 9 + x] > pixels[y * 9 + x + 1] ? 1n : 0n);
  return bits.toString(16).padStart(16, '0');
}
export function similarImage(a: string | null, b: string | null) {
  if (!a || !b) return false;
  let d = BigInt(`0x${a}`) ^ BigInt(`0x${b}`),
    count = 0;
  while (d) {
    count += Number(d & 1n);
    d >>= 1n;
  }
  return count <= 5;
}
