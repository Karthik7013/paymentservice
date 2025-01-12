const express = require('express');
const stripe = require('stripe')('sk_test_51QfNfPI2BljzQKSv7xGethNSgetLKLs6cHxDbS0eYi2dAv6FF8RGGyJBzXpHFvVC6yoNOjUSo1nOmZSu95CGC97t00JduHrTyI');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
const port = 3000;

// Middleware for other routes
app.use(cors());

// Stripe webhook endpoint (use raw middleware here)
const endpointSecret = 'whsec_S1ThEWb8hHLRP1rQnzm7PCah8lASmKba';
// Use express.raw() for the webhook route only
app.post('/api/stripe-webhook', express.raw({ type: 'application/json' }), async (request, response) => {
    let event = request.body;
    // Only verify the event if you have an endpoint secret defined.
    // Otherwise use the basic event deserialized with JSON.parse
    if (endpointSecret) {
        // Get the signature sent by Stripe
        const signature = request.headers['stripe-signature'];
        try {
            event = stripe.webhooks.constructEvent(
                request.body,
                signature,
                endpointSecret
            );
        } catch (err) {
            console.log(`⚠️  Webhook signature verification failed.`, err.message);
            return response.sendStatus(400);
        }
    }

    // Handle the event
    switch (event.type) {
        case 'payment_intent.succeeded':
            const paymentIntent = event.data.object;
            console.log(`PaymentIntent for ${paymentIntent.amount} was successful!`);
            // Then define and call a method to handle the successful payment intent.
            // handlePaymentIntentSucceeded(paymentIntent);
            break;
        default:
            // Unexpected event type
            console.log(`Unhandled event type ${event.type}.`);
    }

    // Return a 200 response to acknowledge receipt of the event
    response.send({ received: true });
});

app.use(bodyParser.json()); // This is for other API routes that don't need the raw body

// Checkout session creation endpoint (unchanged)
app.post("/api/create-checkout-session", async (req, res) => {
    console.log('hello');
    const { products } = req.body;
    const lineItems = products.map((product) => ({
        price_data: {
            currency: "inr",
            product_data: {
                name: product.title,
                images: [product.imgdata] // Ensure `product.imgdata` is a valid image URL
            },
            unit_amount: product.price * 100, // Stripe expects the amount in the smallest currency unit (cents for INR)
        },
        quantity: product.qnty
    }));
    try {
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ["card"],
            line_items: lineItems,
            mode: "payment",
            success_url: "http://localhost:5173/success",
            cancel_url: "http://localhost:5173/failed"
        });

        res.json({ id: session.id });
    } catch (error) {
        console.error("Error creating checkout session:", error.message);
        res.status(500).json({ err: error.message });
    }
});

// Start the server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
