import { v } from "convex/values";
import { action, mutation, query } from "./_generated/server";
import { api } from "./_generated/api";

/**
 * Cloudflare R2 Storage Integration
 * 
 * Required environment variables (set via `npx convex env set`):
 * - R2_ACCOUNT_ID: Cloudflare account ID
 * - R2_ACCESS_KEY_ID: R2 API token access key
 * - R2_SECRET_ACCESS_KEY: R2 API token secret
 * - R2_BUCKET_NAME: R2 bucket name (e.g., "mooderi-images")
 * - R2_PUBLIC_URL: Public URL for the bucket (e.g., "https://images.mooderi.com" or R2.dev URL)
 */

// S3-compatible signature for R2
async function createS3Signature(
  method: string,
  path: string,
  headers: Record<string, string>,
  accessKeyId: string,
  secretAccessKey: string,
  region: string = "auto",
  service: string = "s3"
): Promise<{ authorization: string; amzDate: string }> {
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);

  // Add x-amz-date to headers for signing
  const headersWithDate = { ...headers, "x-amz-date": amzDate };

  // Create canonical request
  const sortedHeaders = Object.entries(headersWithDate)
    .map(([k, v]) => [k.toLowerCase(), v.trim()])
    .sort((a, b) => a[0].localeCompare(b[0]));
  
  const signedHeaders = sortedHeaders.map(([k]) => k).join(";");
  const canonicalHeaders = sortedHeaders.map(([k, v]) => `${k}:${v}`).join("\n") + "\n";
  
  const canonicalRequest = [
    method,
    path,
    "", // query string
    canonicalHeaders,
    signedHeaders,
    "UNSIGNED-PAYLOAD",
  ].join("\n");

  // Create string to sign
  const algorithm = "AWS4-HMAC-SHA256";
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  
  const encoder = new TextEncoder();
  const canonicalRequestHash = await crypto.subtle.digest(
    "SHA-256",
    encoder.encode(canonicalRequest)
  );
  const canonicalRequestHashHex = Array.from(new Uint8Array(canonicalRequestHash))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");

  const stringToSign = [
    algorithm,
    amzDate,
    credentialScope,
    canonicalRequestHashHex,
  ].join("\n");

  // Calculate signature
  async function hmacSha256(key: BufferSource, message: string): Promise<ArrayBuffer> {
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      key as ArrayBuffer,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    return crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(message));
  }

  const kDate = await hmacSha256(encoder.encode(`AWS4${secretAccessKey}`), dateStamp);
  const kRegion = await hmacSha256(kDate, region);
  const kService = await hmacSha256(kRegion, service);
  const kSigning = await hmacSha256(kService, "aws4_request");
  const signature = await hmacSha256(kSigning, stringToSign);
  const signatureHex = Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");

  const authorization = `${algorithm} Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signatureHex}`;

  return { authorization, amzDate };
}

/**
 * Generate a unique file key for R2
 */
function generateFileKey(prefix: string = "images"): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  return `${prefix}/${timestamp}-${random}`;
}

/**
 * Upload a file to R2 from a URL (for migration or external imports)
 */
export const uploadFromUrl = action({
  args: {
    sourceUrl: v.string(),
    prefix: v.optional(v.string()),
    contentType: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ fileKey: string; publicUrl: string }> => {
    const accountId = process.env.R2_ACCOUNT_ID;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    const bucketName = process.env.R2_BUCKET_NAME;
    const publicUrl = process.env.R2_PUBLIC_URL;

    if (!accountId || !accessKeyId || !secretAccessKey || !bucketName || !publicUrl) {
      throw new Error("R2 environment variables not configured");
    }

    // Fetch the image from source URL
    const response = await fetch(args.sourceUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch image from ${args.sourceUrl}: ${response.statusText}`);
    }

    const contentType = args.contentType || response.headers.get("content-type") || "image/jpeg";
    const arrayBuffer = await response.arrayBuffer();
    
    // Generate file key
    const fileKey = generateFileKey(args.prefix || "images");
    const extension = contentType.split("/")[1] || "jpg";
    const fullKey = `${fileKey}.${extension}`;

    // Upload to R2
    const r2Endpoint = `https://${accountId}.r2.cloudflarestorage.com`;
    const path = `/${bucketName}/${fullKey}`;
    const host = `${accountId}.r2.cloudflarestorage.com`;

    const headers: Record<string, string> = {
      "host": host,
      "content-type": contentType,
      "content-length": arrayBuffer.byteLength.toString(),
      "x-amz-content-sha256": "UNSIGNED-PAYLOAD",
    };

    const { authorization, amzDate } = await createS3Signature(
      "PUT",
      path,
      headers,
      accessKeyId,
      secretAccessKey
    );

    const uploadResponse = await fetch(`${r2Endpoint}${path}`, {
      method: "PUT",
      headers: {
        ...headers,
        "x-amz-date": amzDate,
        "Authorization": authorization,
      },
      body: arrayBuffer,
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      throw new Error(`R2 upload failed: ${uploadResponse.status} - ${errorText}`);
    }

    return {
      fileKey: fullKey,
      publicUrl: `${publicUrl}/${fullKey}`,
    };
  },
});

/**
 * Generate a presigned URL for direct browser upload to R2
 */
export const generatePresignedUploadUrl = action({
  args: {
    contentType: v.string(),
    prefix: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ uploadUrl: string; fileKey: string; publicUrl: string }> => {
    const accountId = process.env.R2_ACCOUNT_ID;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    const bucketName = process.env.R2_BUCKET_NAME;
    const publicUrlBase = process.env.R2_PUBLIC_URL;

    if (!accountId || !accessKeyId || !secretAccessKey || !bucketName || !publicUrlBase) {
      throw new Error("R2 environment variables not configured");
    }

    // Generate file key with extension
    const extension = args.contentType.split("/")[1] || "jpg";
    const fileKey = `${generateFileKey(args.prefix || "images")}.${extension}`;

    const r2Endpoint = `https://${accountId}.r2.cloudflarestorage.com`;
    const path = `/${bucketName}/${fileKey}`;
    const host = `${accountId}.r2.cloudflarestorage.com`;

    // For presigned URLs, we need to create a signed URL with expiration
    const now = new Date();
    const expireSeconds = 3600; // 1 hour
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
    const dateStamp = amzDate.slice(0, 8);
    const region = "auto";
    const service = "s3";

    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
    const credential = `${accessKeyId}/${credentialScope}`;

    // Query parameters for presigned URL
    const queryParams = new URLSearchParams({
      "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
      "X-Amz-Credential": credential,
      "X-Amz-Date": amzDate,
      "X-Amz-Expires": expireSeconds.toString(),
      "X-Amz-SignedHeaders": "host;content-type",
    });

    const sortedQueryString = Array.from(queryParams.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join("&");

    // Create canonical request for presigned URL
    const canonicalHeaders = `content-type:${args.contentType}\nhost:${host}\n`;
    const signedHeaders = "content-type;host";

    const canonicalRequest = [
      "PUT",
      path,
      sortedQueryString,
      canonicalHeaders,
      signedHeaders,
      "UNSIGNED-PAYLOAD",
    ].join("\n");

    const encoder = new TextEncoder();
    const canonicalRequestHash = await crypto.subtle.digest(
      "SHA-256",
      encoder.encode(canonicalRequest)
    );
    const canonicalRequestHashHex = Array.from(new Uint8Array(canonicalRequestHash))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");

    const stringToSign = [
      "AWS4-HMAC-SHA256",
      amzDate,
      credentialScope,
      canonicalRequestHashHex,
    ].join("\n");

    // Calculate signature
    async function hmacSha256(key: BufferSource, message: string): Promise<ArrayBuffer> {
      const cryptoKey = await crypto.subtle.importKey(
        "raw",
        key as ArrayBuffer,
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
      );
      return crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(message));
    }

    const kDate = await hmacSha256(encoder.encode(`AWS4${secretAccessKey}`), dateStamp);
    const kRegion = await hmacSha256(kDate, region);
    const kService = await hmacSha256(kRegion, service);
    const kSigning = await hmacSha256(kService, "aws4_request");
    const signature = await hmacSha256(kSigning, stringToSign);
    const signatureHex = Array.from(new Uint8Array(signature))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");

    const presignedUrl = `${r2Endpoint}${path}?${sortedQueryString}&X-Amz-Signature=${signatureHex}`;

    return {
      uploadUrl: presignedUrl,
      fileKey,
      publicUrl: `${publicUrlBase}/${fileKey}`,
    };
  },
});

/**
 * Delete a file from R2
 */
export const deleteFile = action({
  args: {
    fileKey: v.string(),
  },
  handler: async (ctx, args): Promise<{ success: boolean }> => {
    const accountId = process.env.R2_ACCOUNT_ID;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    const bucketName = process.env.R2_BUCKET_NAME;

    if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
      throw new Error("R2 environment variables not configured");
    }

    const r2Endpoint = `https://${accountId}.r2.cloudflarestorage.com`;
    const path = `/${bucketName}/${args.fileKey}`;
    const host = `${accountId}.r2.cloudflarestorage.com`;

    const headers: Record<string, string> = {
      "host": host,
      "x-amz-content-sha256": "UNSIGNED-PAYLOAD",
    };

    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");

    const { authorization } = await createS3Signature(
      "DELETE",
      path,
      { ...headers, "x-amz-date": amzDate },
      accessKeyId,
      secretAccessKey
    );

    const deleteResponse = await fetch(`${r2Endpoint}${path}`, {
      method: "DELETE",
      headers: {
        ...headers,
        "x-amz-date": amzDate,
        "Authorization": authorization,
      },
    });

    // 204 No Content is success for DELETE
    if (!deleteResponse.ok && deleteResponse.status !== 204) {
      const errorText = await deleteResponse.text();
      throw new Error(`R2 delete failed: ${deleteResponse.status} - ${errorText}`);
    }

    return { success: true };
  },
});

/**
 * Get the public URL for a file stored in R2
 */
export const getPublicUrl = query({
  args: {
    fileKey: v.string(),
  },
  handler: async (ctx, args): Promise<string> => {
    const publicUrl = process.env.R2_PUBLIC_URL;
    if (!publicUrl) {
      throw new Error("R2_PUBLIC_URL environment variable not configured");
    }
    return `${publicUrl}/${args.fileKey}`;
  },
});

/**
 * Helper to check if R2 is configured
 */
export const isConfigured = query({
  args: {},
  handler: async (): Promise<boolean> => {
    return !!(
      process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET_NAME &&
      process.env.R2_PUBLIC_URL
    );
  },
});
