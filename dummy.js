const express = require('express');
const stripe = require('stripe')('sk_test_**************');  // Replace with your secret key
const { Pool } = require('pg');  // PostgreSQL client
const bodyParser = require('body-parser');

// Initialize Express app
const app = express();
const port = 3000;

// Set up PostgreSQL client
const pool = new Pool({
    user: 'your_user',     // Replace with your PostgreSQL user
    host: 'your_host',     // Replace with your host (localhost or database host)
    database: 'your_db',   // Replace with your database name
    password: 'your_password', // Replace with your password
    port: 5432,            // Default PostgreSQL port
});

// Parse incoming JSON payloads
app.use(bodyParser.json());

// Webhook secret from Stripe (you get this when setting up the webhook endpoint in Stripe)
const endpointSecret = 'whsec_**************';  // Replace with your actual secret

// Function to insert transaction into PostgreSQL database
async function insertTransaction(paymentIntentId, amount, status, customerId) {
    const client = await pool.connect();
    try {
        const result = await client.query(
            'INSERT INTO transaction_table(payment_intent_id, amount, status, customer_id) VALUES($1, $2, $3, $4)',
            [paymentIntentId, amount, status, customerId]
        );
        console.log('Transaction inserted:', result.rows);
    } catch (error) {
        console.error('Error inserting transaction:', error);
    } finally {
        client.release();
    }
}

// Webhook route to receive events from Stripe
app.post('/stripe-webhook', async (req, res) => {
    const payload = req.body;
    const sigHeader = req.headers['stripe-signature'];

    let event;

    // Verify the webhook signature to ensure it came from Stripe
    try {
        event = stripe.webhooks.constructEvent(payload, sigHeader, endpointSecret);
    } catch (err) {
        console.error('Webhook signature verification failed:', err);
        return res.status(400).send('Webhook Error: ' + err.message);
    }

    // Handle the event
    switch (event.type) {
        case 'payment_intent.succeeded':
            const paymentIntent = event.data.object;
            const paymentIntentId = paymentIntent.id;
            const amountReceived = paymentIntent.amount_received / 100;  // Amount is in cents, converting to dollars
            const status = paymentIntent.status;
            const customerId = paymentIntent.customer;

            // Insert the transaction into the database
            await insertTransaction(paymentIntentId, amountReceived, status, customerId);

            console.log(`PaymentIntent for ${amountReceived} was successful!`);

            break;

        // Handle other event types as needed
        // case 'payment_intent.failed':
        //   // Handle failed payment intents
        //   break;

        default:
            console.log(`Unhandled event type: ${event.type}`);
    }

    // Respond to Stripe to acknowledge receipt of the event
    res.json({ received: true });
});

// Start the Express server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
