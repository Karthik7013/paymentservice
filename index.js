const express = require('express');
const stripe = require('stripe');
const bodyParser = require('body-parser');
const cors = require('cors');

// Secret key
const stripeClient = stripe('sk_test_51QfNfPI2BljzQKSv7xGethNSgetLKLs6cHxDbS0eYi2dAv6FF8RGGyJBzXpHFvVC6yoNOjUSo1nOmZSu95CGC97t00JduHrTyI');
const app = express();
app.use(cors());
app.use(bodyParser.json());
const port = 3000;

app.post("/api/create-checkout-session", async (req, res) => {
    console.log('hellow')
    const { products } = req.body;
    const lineItems = products.map((product) => ({
        price_data: {
            currency: "inr",
            product_data: {
                name: product.title,
                images: [product.imgdata] // Make sure `product.imgdata` is a valid image URL
            },
            unit_amount: product.price * 100, // Stripe expects the amount in the smallest currency unit (cents for INR)
        },
        quantity: product.qnty
    }));
    try {
        const session = await stripeClient.checkout.sessions.create({
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


app.post('/api/stripe-webhook', async (req, res) => {
    const sigHeader = req.headers['stripe-signature'];
    let event;

    try {
        // Verify the webhook signature using Stripe's webhooks constructEvent method
        event = stripe.webhooks.constructEvent(req.body, sigHeader, endpointSecret);
    } catch (err) {
        console.log(`Webhook signature verification failed: ${err}`);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event based on the event type
    switch (event.type) {
        case 'payment_intent.succeeded':
            const paymentIntent = event.data.object;
            const transactionId = paymentIntent.id;
            const amountReceived = paymentIntent.amount_received / 100;  // Convert from cents to your currency
            const status = paymentIntent.status;
            const customerId = paymentIntent.customer;

            try {
                // Insert transaction data into PostgreSQL
                const result = await client.query(
                    'INSERT INTO transactions (transaction_id, amount, status, customer_id) VALUES ($1, $2, $3, $4) RETURNING *',
                    [transactionId, amountReceived, status, customerId]
                );
                console.log('Transaction inserted:', result.rows[0]);
            } catch (error) {
                console.error('Error inserting transaction into database:', error);
            }
            break;

        case 'payment_intent.payment_failed':
            const failedPaymentIntent = event.data.object;
            console.log(`Payment failed: ${failedPaymentIntent.id}`);
            break;

        default:
            console.log(`Unhandled event type: ${event.type}`);
    }

    // Return a success response to Stripe
    res.json({ received: true });
});

// Start the server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
