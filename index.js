const express = require('express');
const stripe = require('stripe')('sk_test_51QfNfPI2BljzQKSv7xGethNSgetLKLs6cHxDbS0eYi2dAv6FF8RGGyJBzXpHFvVC6yoNOjUSo1nOmZSu95CGC97t00JduHrTyI');
const bodyParser = require('body-parser');
const cors = require('cors');
// const { Client } = require('pg');

// PostgreSQL client setup
// const client = new Client({
//     user: 'your_user',
//     host: 'localhost',
//     database: 'your_database',
//     password: 'your_password',
//     port: 5432,
// });
// client.connect();

const app = express();
const port = 3000;

// Middleware for other routes
app.use(cors());
app.use(bodyParser.json()); // This is for other API routes that don't need the raw body

// Stripe webhook endpoint (use raw middleware here)
const endpointSecret = 'whsec_S1ThEWb8hHLRP1rQnzm7PCah8lASmKba';
app.post('/api/stripe-webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const sigHeader = req.headers['stripe-signature'];
    let event;
    try {
        // Verify the webhook signature using Stripe's constructEvent method
        event = stripe.webhooks.constructEvent(req.body, sigHeader, endpointSecret);
    } catch (err) {
        console.log(`Webhook signature verification failed: ${err}`);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }
    console.log(event);

    // Handle the event based on the event type
    // switch (event.type) {
    //     case 'payment_intent.succeeded':
    //         const paymentIntent = event.data.object;
    //         const transactionId = paymentIntent.id;
    //         const amountReceived = paymentIntent.amount_received / 100;  // Convert from cents to your currency
    //         const status = paymentIntent.status;
    //         const customerId = paymentIntent.customer;

    //         try {
    //             // Insert transaction data into PostgreSQL
    //             const result = await client.query(
    //                 'INSERT INTO transactions (transaction_id, amount, status, customer_id) VALUES ($1, $2, $3, $4) RETURNING *',
    //                 [transactionId, amountReceived, status, customerId]
    //             );
    //             console.log('Transaction inserted:', result.rows[0]);
    //         } catch (error) {
    //             console.error('Error inserting transaction into database:', error);
    //         }
    //         break;

    //     case 'payment_intent.payment_failed':
    //         const failedPaymentIntent = event.data.object;
    //         console.log(`Payment failed: ${failedPaymentIntent.id}`);
    //         break;

    //     default:
    //         console.log(`Unhandled event type: ${event.type}`);
    // }

    // Return a success response to Stripe
    res.json({ received: true });
});

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
