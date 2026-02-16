import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  CopyObjectCommand,
  GetObjectCommand,

} from "@aws-sdk/client-s3";
import fs from "fs";

import { getSignedUrl as getS3SignedUrl } from "@aws-sdk/s3-request-presigner";
import { getSignedUrl as getCloudFrontSignedUrl } from "@aws-sdk/cloudfront-signer";

/* ============================================================
   ENV + CLIENT SETUP
============================================================ */

const bucket = process.env.AWS_BUCKET_NAME;
if (!bucket) throw new Error("AWS_BUCKET_NAME is missing");

const CLOUDFRONT_URL = process.env.CLOUDFRONT_URL;
if (!CLOUDFRONT_URL) throw new Error("CLOUDFRONT_URL is missing");

export const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
  //  requestChecksumCalculation: "NEVER",
});

/* ============================================================
   CLOUD FRONT SIGNED GET URL
============================================================ */

export function generateCloudFrontViewUrl(key) {
  const cleanDomain = CLOUDFRONT_URL.replace(/\/$/, "");
  const privateKey = fs.readFileSync("./private_key.pem", "utf8");

  return getCloudFrontSignedUrl({
    url: `${cleanDomain}/${key}`,
    keyPairId: process.env.KEY_PAIR_ID,
    privateKey,
    dateLessThan: new Date(Date.now() + 60 * 60 * 1000),
  });
}



export async function generateS3DownloadUrl({ key, filename }) {
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
    ResponseContentDisposition: `attachment; filename="${filename}"`,
  });

  return getSignedUrl(s3Client, command, {
    expiresIn: 60 * 60,
  });
}



/* ============================================================
   PRESIGNED UPLOAD URL (uploads/active)
============================================================ */

export const generatePreSignedUploadURL = async ({
  key,
  contentType,
}) => {
  if (!key) throw new Error("S3 key is required");

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: `uploads/active/${key}`,
    ContentType: contentType,
    // ContentLength:
    // ChecksumAlgorithm: undefined,
  });

  return await getS3SignedUrl(s3Client, command, {
    expiresIn: 300, // 5 minutes
    signableHeaders: new Set(["content-type"]),
  });
};

/* ============================================================
   FILE METADATA
============================================================ */

export const getFileContentLength = async ({ key }) => {
  const command = new HeadObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  const meta = await s3Client.send(command);
  return meta?.ContentLength;
};

/* ============================================================
   HARD DELETE
============================================================ */

export const deleteS3Object = async ({ key }) => {
  const command = new DeleteObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  return await s3Client.send(command);
};

export const deleteS3Objects = async ({ keys }) => {
  const command = new DeleteObjectsCommand({
    Bucket: bucket,
    Delete: {
      Objects: keys.map((Key) => ({ Key })),
      Quiet: false,
    },
  });

  return await s3Client.send(command);
};

/* ============================================================
   SOFT DELETE (active → deleted)
============================================================ */

export const softDeleteS3Object = async ({ key }) => {
  if (!key) throw new Error("Key is required");

  const sourceKey = `uploads/active/${key}`;
  const deletedKey = `uploads/deleted/${key}`;

  // Copy to deleted
  await s3Client.send(
    new CopyObjectCommand({
      Bucket: bucket,
      CopySource: `${bucket}/${sourceKey}`,
      Key: deletedKey,
      MetadataDirective: "COPY",
    })
  );

  // Remove original
  await s3Client.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: sourceKey,
    })
  );
};

/* ============================================================
   RESTORE (deleted → active)
============================================================ */

export const restoreS3Object = async ({ key }) => {
  if (!key) throw new Error("Key is required");

  const deletedKey = `uploads/deleted/${key}`;
  const activeKey = `uploads/active/${key}`;

  await s3Client.send(
    new CopyObjectCommand({
      Bucket: bucket,
      CopySource: `${bucket}/${deletedKey}`,
      Key: activeKey,
      MetadataDirective: "COPY",
    })
  );

  await s3Client.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: deletedKey,
    })
  );
};
