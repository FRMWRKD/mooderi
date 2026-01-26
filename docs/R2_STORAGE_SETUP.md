# Cloudflare R2 Storage Migration Guide

This guide explains how to set up Cloudflare R2 storage for Mooderi.

## Overview

The application now supports **dual storage**:
- **Cloudflare R2** (recommended) - For new uploads
- **Convex Storage** (legacy) - Existing images continue to work

When R2 is configured, all new uploads go to R2. If R2 is not configured, uploads fall back to Convex Storage.

---

## Step 1: Create Cloudflare Account & R2 Bucket

### 1.1 Sign up / Log in to Cloudflare
1. Go to [https://dash.cloudflare.com](https://dash.cloudflare.com)
2. Sign up or log in to your account

### 1.2 Enable R2 Storage
1. In the Cloudflare dashboard, click **R2** in the left sidebar
2. If prompted, add a payment method (R2 has a generous free tier: 10GB storage, 10M requests/month free)
3. Click **Create bucket**

### 1.3 Create Your Bucket
1. **Bucket name**: `mooderi-images` (or your preferred name)
2. **Location**: Choose a region close to your users (or leave as "Automatic")
3. Click **Create bucket**

---

## Step 2: Enable Public Access

You have two options for public access:

### Option A: R2.dev Subdomain (Easiest)
1. Go to your bucket settings
2. Click **Settings** tab
3. Under **Public access**, click **Allow Access**
4. Enable the **R2.dev subdomain**
5. Copy the URL (e.g., `https://pub-xxxxxxxxxxxx.r2.dev`)

### Option B: Custom Domain (Recommended for Production)
1. Go to your bucket settings
2. Click **Settings** tab
3. Under **Custom domains**, click **Connect Domain**
4. Enter your domain (e.g., `images.mooderi.com`)
5. Follow the DNS setup instructions
6. Once verified, your public URL will be `https://images.mooderi.com`

---

## Step 3: Configure CORS

1. In your bucket, go to **Settings** tab
2. Scroll to **CORS Policy**
3. Click **Add CORS policy** and add:

```json
[
  {
    "AllowedOrigins": [
      "http://localhost:3005",
      "http://localhost:3000",
      "https://mooderi.com",
      "https://*.mooderi.com",
      "https://*.vercel.app"
    ],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

4. Click **Save**

---

## Step 4: Create API Token

1. In the Cloudflare dashboard, go to **R2** → **Overview**
2. Click **Manage R2 API Tokens** (on the right side)
3. Click **Create API Token**
4. Configure the token:
   - **Token name**: `mooderi-upload`
   - **Permissions**: Select **Object Read & Write**
   - **Bucket scope**: Select your bucket (`mooderi-images`)
   - **TTL**: Optional (leave empty for no expiration)
5. Click **Create API Token**
6. **IMPORTANT**: Copy and save these values immediately:
   - **Access Key ID** (looks like: `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`)
   - **Secret Access Key** (looks like: `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`)

---

## Step 5: Get Your Account ID

1. Go to any page in your Cloudflare dashboard
2. Look at the URL - it contains your account ID:
   `https://dash.cloudflare.com/XXXXXX/...`
3. Or go to **R2** → Click your bucket → The URL shows:
   `https://dash.cloudflare.com/ACCOUNT_ID/r2/default/buckets/mooderi-images`
4. Copy the `ACCOUNT_ID` portion

---

## Step 6: Set Environment Variables in Convex

Run these commands to set the R2 credentials in Convex:

```bash
# Navigate to your project root
cd c:\Users\Steven\Work\mooderi

# Set R2 environment variables
 "your-account-id"
npx convex env set R2_ACCESS_KEY_ID "your-access-key-id"
npx convex env set R2_SECRET_ACCESS_KEY "your-secret-access-key"
npx convex env set R2_BUCKET_NAME "mooderi-images"
npx convex env set R2_PUBLIC_URL "https://pub-xxxx.r2.dev"
```

**Replace the values with your actual credentials:**
- `R2_ACCOUNT_ID`: Your Cloudflare account ID (from Step 5)
- `R2_ACCESS_KEY_ID`: The Access Key ID from the API token (from Step 4)
- `R2_SECRET_ACCESS_KEY`: The Secret Access Key from the API token (from Step 4)
- `R2_BUCKET_NAME`: Your bucket name (e.g., `mooderi-images`)
- `R2_PUBLIC_URL`: Your public URL (from Step 2, e.g., `https://pub-xxxx.r2.dev` or `https://images.mooderi.com`)

---

## Step 7: Verify Configuration


# Terminal 2 - Frontend
cd frontend && npm run dev
```

2. Check the browser console when uploading an image:
   - You should see: `[UploadModal] Using Cloudflare
1. Restart your development servers:
```bash
# Terminal 1 - Convex
npx convex dev R2 storage`
   - If R2 is not configured, you'll see: `[UploadModal] Using Convex Storage (R2 not configured)`

---

## Environment Variables Summary

| Variable | Description | Example |
|----------|-------------|---------|
| `R2_ACCOUNT_ID` | Cloudflare account ID | `1234567890abcdef` |
| `R2_ACCESS_KEY_ID` | R2 API access key | `xxxxxxxx...` |
| `R2_SECRET_ACCESS_KEY` | R2 API secret | `yyyyyyyy...` |
| `R2_BUCKET_NAME` | Bucket name | `mooderi-images` |
| `R2_PUBLIC_URL` | Public URL for images | `https://images.mooderi.com` |

---

## Migration of Existing Images (Optional)

If you have existing images in Convex Storage and want to migrate them to R2:

1. Export image URLs from your database
2. Use the `r2Storage.uploadFromUrl` action to copy each image to R2
3. Update the database records with new R2 URLs and keys

Example migration script (run in Convex dashboard or as a one-time action):
```typescript
// This would be run as a Convex action/mutation
const images = await ctx.db.query("images").collect();
for (const image of images) {
  if (image.storageId && !image.r2Key) {
    // Migrate to R2
    const result = await ctx.runAction(api.r2Storage.uploadFromUrl, {
      sourceUrl: image.imageUrl,
      prefix: "migrated",
    });
    await ctx.db.patch(image._id, {
      r2Key: result.fileKey,
      imageUrl: result.publicUrl,
    });
  }
}
```

---

## Troubleshooting

### "R2 environment variables not configured"
- Verify all 5 environment variables are set in Convex
- Run `npx convex env list` to check

### "403 Forbidden" on upload
- Check CORS policy includes your domain
- Verify API token has "Object Read & Write" permissions
- Ensure the token is scoped to your bucket

### "SignatureDoesNotMatch" error
- Double-check the secret access key (no extra spaces)
- Ensure the access key ID and secret are from the same token

### Images not loading
- Verify public access is enabled on the bucket
- Check the R2_PUBLIC_URL is correct
- Test the URL directly in your browser

---

## Cost Estimate

Cloudflare R2 pricing (as of 2024):
- **Storage**: First 10GB free, then $0.015/GB/month
- **Class A operations** (writes): First 1M free, then $4.50/million
- **Class B operations** (reads): First 10M free, then $0.36/million
- **Egress**: FREE (no bandwidth charges!)

For a typical image gallery app with moderate usage, R2 will likely cost $0-5/month.
