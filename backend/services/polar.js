const { Polar } = require('@polar-sh/sdk');

// Initialize Polar client
const polar = new Polar({
    accessToken: process.env.POLAR_ACCESS_TOKEN,
});

/**
 * Create a checkout session for purchasing credits
 * @param {string} productPriceId - The Polar product price ID
 * @param {string} customerEmail - Customer email
 * @param {string} successUrl - URL to redirect after successful payment
 * @returns {Promise<Object>} Checkout session with URL
 */
async function createCheckout(productPriceId, customerEmail, successUrl) {
    try {
        const checkout = await polar.checkouts.create({
            productPriceId,
            customerEmail,
            successUrl,
            // Store custom data to identify the purchase
            customData: {
                source: 'moodboard',
                timestamp: new Date().toISOString(),
            },
        });

        return {
            success: true,
            checkoutUrl: checkout.url,
            checkoutId: checkout.id,
        };
    } catch (error) {
        console.error('Polar checkout creation error:', error);
        return {
            success: false,
            error: error.message,
        };
    }
}

/**
 * Get customer portal URL for managing subscriptions
 * @param {string} customerId - Polar customer ID
 * @returns {Promise<string>} Customer portal URL
 */
async function getCustomerPortalUrl(customerId) {
    try {
        const portal = await polar.customerPortal.get({
            customerId,
        });
        return portal.url;
    } catch (error) {
        console.error('Polar customer portal error:', error);
        throw error;
    }
}

/**
 * Handle subscription webhook event
 * @param {Object} event - Webhook event from Polar
 * @param {Function} supabase - Supabase client
 * @returns {Promise<void>}
 */
async function handleSubscriptionEvent(event, supabase) {
    const { type, data } = event;

    switch (type) {
        case 'subscription.created':
        case 'subscription.active':
            // Grant credits when subscription becomes active
            await grantSubscriptionCredits(data.subscription, supabase);
            break;

        case 'subscription.canceled':
        case 'subscription.revoked':
            // Handle subscription cancellation
            await handleSubscriptionCancellation(data.subscription, supabase);
            break;

        case 'subscription.product_updated':
            // Update subscription tier/credits
            await updateSubscriptionTier(data.subscription, supabase);
            break;

        default:
            console.log(`Unhandled subscription event: ${type}`);
    }
}

/**
 * Handle order webhook event
 * @param {Object} event - Webhook event from Polar
 * @param {Function} supabase - Supabase client
 * @returns {Promise<void>}
 */
async function handleOrderEvent(event, supabase) {
    const { type, data } = event;

    if (type === 'order.paid') {
        // One-time purchase of credits
        await grantPurchaseCredits(data.order, supabase);
    }
}

/**
 * Grant credits based on subscription
 * @param {Object} subscription - Subscription data
 * @param {Function} supabase - Supabase client
 */
async function grantSubscriptionCredits(subscription, supabase) {
    const { customerId, productId } = subscription;

    // Get customer email to find user
    const customer = await polar.customers.get({ id: customerId });
    const userEmail = customer.email;

    // Find user in Supabase
    const { data: { user } } = await supabase.auth.admin.getUserByEmail(userEmail);

    if (!user) {
        console.error('User not found for email:', userEmail);
        return;
    }

    // Determine credits based on product
    const creditMap = {
        // Map your Polar product IDs to credit amounts
        'prod_basic': 100,
        'prod_pro': 500,
        'prod_unlimited': 10000,
    };

    const credits = creditMap[productId] || 0;

    if (credits > 0) {
        // Add credits to user
        await supabase.rpc('add_credits', {
            p_user_id: user.id,
            p_amount: credits,
        });

        console.log(`Granted ${credits} credits to user ${user.id}`);
    }
}

/**
 * Grant credits for one-time purchase
 * @param {Object} order - Order data
 * @param {Function} supabase - Supabase client
 */
async function grantPurchaseCredits(order, supabase) {
    const { customerId, productId, amount } = order;

    // Get customer
    const customer = await polar.customers.get({ id: customerId });
    const userEmail = customer.email;

    const { data: { user } } = await supabase.auth.admin.getUserByEmail(userEmail);

    if (!user) {
        console.error('User not found for email:', userEmail);
        return;
    }

    // Map product to credits
    const creditMap = {
        'prod_credits_10': 10,
        'prod_credits_50': 50,
        'prod_credits_100': 100,
        'prod_credits_500': 500,
    };

    const credits = creditMap[productId] || 0;

    if (credits > 0) {
        await supabase.rpc('add_credits', {
            p_user_id: user.id,
            p_amount: credits,
        });

        console.log(`Granted ${credits} credits to user ${user.id} from purchase`);
    }
}

/**
 * Handle subscription cancellation
 */
async function handleSubscriptionCancellation(subscription, supabase) {
    console.log('Subscription canceled:', subscription.id);
    // Optionally: mark subscription as canceled in your DB
}

/**
 * Update subscription tier
 */
async function updateSubscriptionTier(subscription, supabase) {
    console.log('Subscription updated:', subscription.id);
    // Handle tier changes
}

module.exports = {
    polar,
    createCheckout,
    getCustomerPortalUrl,
    handleSubscriptionEvent,
    handleOrderEvent,
};
