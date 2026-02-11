import { Client } from "minio";
import { env } from "../config/env";

export const minioClient = new Client({
  endPoint: env.MINIO_ENDPOINT,
  port: env.MINIO_PORT,
  useSSL: env.MINIO_USE_SSL,
  accessKey: env.MINIO_ACCESS_KEY,
  secretKey: env.MINIO_SECRET_KEY,
  region: env.MINIO_REGION
});

export const PUBLIC_BUCKET = "images";
export const PRIVATE_BUCKET = "payments";

const getPublicBucketPolicy = (bucket: string) =>
  JSON.stringify({
    Version: "2012-10-17",
    Statement: [
      {
        Effect: "Allow",
        Principal: { AWS: ["*"] },
        Action: ["s3:GetObject"],
        Resource: [`arn:aws:s3:::${bucket}/*`]
      }
    ]
  });

export const ensureBucket = async (bucket: string, publicRead = false) => {
  const exists = await minioClient.bucketExists(bucket);

  if (!exists) {
    if (env.MINIO_REGION) {
      await minioClient.makeBucket(bucket, env.MINIO_REGION);
    } else {
      await minioClient.makeBucket(bucket);
    }
  }

  if (publicRead) {
    await minioClient.setBucketPolicy(bucket, getPublicBucketPolicy(bucket));
  }
};

export const ensureDefaultBuckets = async () => {
  await ensureBucket(PUBLIC_BUCKET, true);
  await ensureBucket(PRIVATE_BUCKET, false);
};

export type UploadObjectParams = {
  bucket: string;
  objectName: string;
  filePath?: string;
  buffer?: Buffer;
  contentType?: string;
};

export const uploadObject = async ({
  bucket,
  objectName,
  filePath,
  buffer,
  contentType
}: UploadObjectParams) => {
  if (!filePath && !buffer) {
    throw new Error("Se requiere filePath o buffer");
  }

  if (filePath) {
    return minioClient.fPutObject(
      bucket,
      objectName,
      filePath,
      contentType ? { "Content-Type": contentType } : undefined
    );
  }

  return minioClient.putObject(
    bucket,
    objectName,
    buffer as Buffer,
    contentType ? { "Content-Type": contentType } : undefined
  );
};

export const deleteObject = async (bucket: string, objectName: string) =>
  minioClient.removeObject(bucket, objectName);

export const getPrivateObjectUrl = async (
  bucket: string,
  objectName: string,
  expirySeconds = 300
) => minioClient.presignedGetObject(bucket, objectName, expirySeconds);

export const getPublicObjectUrl = (bucket: string, objectName: string) => {
  const baseUrl = env.MINIO_PUBLIC_URL.replace(/\/$/, "");
  return `${baseUrl}/${bucket}/${objectName}`;
};

export const getObjectStream = (bucket: string, objectName: string) =>
  minioClient.getObject(bucket, objectName);

export const uploadPublicObject = async (
  params: Omit<UploadObjectParams, "bucket">
) => uploadObject({ ...params, bucket: PUBLIC_BUCKET });

export const uploadPrivateObject = async (
  params: Omit<UploadObjectParams, "bucket">
) => uploadObject({ ...params, bucket: PRIVATE_BUCKET });

export const deletePublicObject = async (objectName: string) =>
  deleteObject(PUBLIC_BUCKET, objectName);

export const deletePrivateObject = async (objectName: string) =>
  deleteObject(PRIVATE_BUCKET, objectName);

export const getPrivateObjectFromDefaultBucket = async (
  objectName: string,
  expirySeconds?: number
) => getPrivateObjectUrl(PRIVATE_BUCKET, objectName, expirySeconds);

export const getPublicObjectFromDefaultBucket = (objectName: string) =>
  getPublicObjectUrl(PUBLIC_BUCKET, objectName);
