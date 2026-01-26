# Polar Sandbox Testing Guide

This guide provides test information for testing payments in Polar's sandbox environment.

## Sandbox vs Production

| Environment | Dashboard URL | API URL |
|-------------|---------------|---------|
| Sandbox | https://sandbox.polar.sh | https://sandbox-api.polar.sh |
| Production | https://polar.sh | https://api.polar.sh |

## Test Card Numbers

Use these test card numbers in the Polar sandbox checkout:

### Successful Payments

| Card Number | Description |
|-------------|-------------|
| `4242 4242 4242 4242` | Visa - Always succeeds |
| `5555 5555 5555 4444` | Mastercard - Always succeeds |
| `3782 822463 10005` | American Express - Always succeeds |

### For All Test Cards

- **Expiry Date**: Any future date (e.g., `12/34` or `01/30`)
- **CVC**: Any 3 digits (e.g., `123`) or 4 digits for Amex (e.g., `1234`)
- **ZIP/Postal Code**: Any valid format (e.g., `12345`)
- **Name**: Any name (e.g., `Test User`)

### Cards That Simulate Failures

| Card Number | Description |
|-------------|-------------|
| `4000 0000 0000 0002` | Card declined |
| `4000 0000 0000 9995` | Insufficient funds |
| `4000 0000 0000 9987` | Lost card |
| `4000 0000 0000 9979` | Stolen card |

## Test Email Addresses

You can use any email format. For testing, use:
- `test@example.com`
- `yourname+test@gmail.com` (Gmail allows + aliases)

## Current Sandbox Products

These products are configured in the Polar sandbox dashboard:

| Product | UUID | Price | Type |
|---------|------|-------|------|
| Starter Pack | `40cb9a7a-0df9-4f38-9227-12639f0277ca` | $5.00 | One-time |
| Pro Pack | `8430c00c-872d-4b61-8fef-bcc3e427b82e` | $20.00 | One-time |
| Unlimited Monthly | `5b4044d6-b900-4aaf-861e-c5ab3829a35b` | $15.00/month | Subscription |

## Testing Workflow

1. **Go to Pricing Page**: Navigate to `/pricing` in your app
2. **Sign In**: Make sure you're logged in (checkout requires authentication)
3. **Select a Package**: Click on any package button
4. **New Tab Opens**: Polar checkout opens in a new browser tab
5. **Enter Test Card**: Use `4242 4242 4242 4242` with any future expiry
6. **Complete Purchase**: Fill in any test details and submit
7. **Redirect**: After success, you'll be redirected back to `/pricing?success=true`

## Checking Sandbox Transactions

1. Go to https://sandbox.polar.sh
2. Log in with your Polar account
3. Navigate to **Orders** or **Customers** to see test transactions

## Webhook Configuration

**IMPORTANT:** You must configure a webhook in Polar for credits to be added after purchase.

1. Go to https://sandbox.polar.sh → **Settings** → **Webhooks**
2. Click **Add Webhook**
3. Enter URL: `https://hidden-falcon-801.convex.site/polar/order-webhook`
   - **IMPORTANT**: Use `.convex.site` (not `.convex.cloud`) for HTTP routes!
4. Subscribe to events:
   - `checkout.updated`
   - `order.paid`
5. Save the webhook

Without this webhook, payments will complete but credits won't be added.

## Environment Variables (Convex)

For sandbox testing, these should be set:

```bash
POLAR_ORGANIZATION_TOKEN=polar_oat_xxx  # Your sandbox organization token
POLAR_STARTER_PACK_ID=40cb9a7a-0df9-4f38-9227-12639f0277ca
POLAR_PRO_PACK_ID=8430c00c-872d-4b61-8fef-bcc3e427b82e
POLAR_UNLIMITED_MONTHLY_ID=5b4044d6-b900-4aaf-861e-c5ab3829a35b
```

## Switching to Production

When ready for production:

1. Create products in https://polar.sh (production dashboard)
2. Get new product UUIDs from production
3. Update Convex environment variables with production values
4. Change `server: "sandbox"` to `server: "production"` in `convex/payments.ts`
5. Update frontend `POLAR_PRODUCT_IDS` in `frontend/src/app/pricing/page.tsx`

## Troubleshooting

### Checkout doesn't open
- Check browser console for errors
- Ensure you're logged in
- Check that popup blocker isn't blocking the new tab

### "User must be authenticated" error
- Sign out and sign back in
- Check that your session is valid

### "Failed to create checkout" error
- Verify product UUIDs are correct
- Check Convex logs: `npx convex logs`
- Ensure `POLAR_ORGANIZATION_TOKEN` is set correctly

## Notes

- Sandbox transactions are **not real** - no actual charges occur
- Sandbox and production are completely separate environments
- Product UUIDs are different between sandbox and production
