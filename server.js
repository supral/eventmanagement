// getting port from .env file
require("dotenv").config();
const express = require('express');
const bcrypt = require("bcrypt");
const bodyParser = require('body-parser');
const jwt = require("jsonwebtoken");
const generateAccessToken = require("./generateAccessToken");
const generateRefreshToken = require("./generateRefreshToken");
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const DB_HOST = process.env.DB_HOST;
const DB_USER = process.env.DB_USER;
const DB_PASSWORD = ""; // No password
const DB_DATABASE = "event_management"; // Updated database name
const port = process.env.PORT || 3000; // Default to 3000 if not set

var mysql = require('mysql');

var db = mysql.createPool({
  host: DB_HOST, 
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_DATABASE
}); 

db.getConnection((err, connection) => {
    if (err) throw (err);
    console.log("DB connected successfully: " + connection.threadId);
});

const app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());

app.post("/register", async (req, res) => {
    const { fname, lname, email, phone, password, username } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    db.getConnection(async (err, connection) => {
        if (err) throw (err);
        const sqlSearch = "SELECT * FROM user WHERE email = ?";
        const search_query = mysql.format(sqlSearch, [email]);
        const sqlInsert = "INSERT INTO user (fname, lname, email, phone, password, username) VALUES (?, ?, ?, ?, ?, ?)";
        const insert_query = mysql.format(sqlInsert, [fname, lname, email, phone, hashedPassword, username]);

        await connection.query(search_query, async (err, result) => {
            if (err) throw (err);
            if (result.length != 0) {
                connection.release();
                res.sendStatus(409);
            } else {
                await connection.query(insert_query, (err, result) => {
                    connection.release();
                    if (err) throw (err);
                    res.sendStatus(201);
                });
            }
        });
    });
});

app.post("/login", (req, res) => {
    const { email, password } = req.body;

    db.getConnection(async (err, connection) => {
        if (err) throw (err);
        const sqlSearch = "SELECT * FROM user WHERE email = ?";
        const search_query = mysql.format(sqlSearch, [email]);

        await connection.query(search_query, async (err, result) => {
            connection.release();
            if (err) throw (err);
            if (result.length == 0) {
                res.sendStatus(404);
            } else {
                const hashedPassword = result[0].password;
                if (await bcrypt.compare(password, hashedPassword)) {
                    const accessToken = generateAccessToken({ user: req.body.email });
                    const refreshToken = generateRefreshToken({ user: req.body.email });
                    res.json({ accessToken: accessToken, refreshToken: refreshToken });
                } else {
                    res.send("Password incorrect!");
                }
            }
        });
    });
});

app.post("/changepassword", async (req, res) => {
    const { email, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    db.getConnection(async (err, connection) => {
        if (err) throw (err);
        const sqlSearch = "SELECT * FROM user WHERE email = ?";
        const search_query = mysql.format(sqlSearch, [email]);
        const sqlUpdate = "UPDATE user SET password = ? WHERE email = ?";
        const update_query = mysql.format(sqlUpdate, [hashedPassword, email]);

        await connection.query(search_query, async (err, result) => {
            if (err) throw (err);
            if (result.length == 0) {
                res.sendStatus(404);
            } else {
                await connection.query(update_query, (err, result) => {
                    connection.release();
                    if (err) throw (err);
                    res.sendStatus(200);
                });
            }
        });
    });
});

app.post("/refreshToken", (req, res) => {
    if (!refreshTokens.includes(req.body.token)) 
        res.status(400).send("Refresh Token Invalid");
    refreshTokens = refreshTokens.filter(c => c != req.body.token);
    const accessToken = generateAccessToken({ user: req.body.name });
    const refreshToken = generateRefreshToken({ user: req.body.name });
    res.json({ accessToken: accessToken, refreshToken: refreshToken });
});

app.delete("/logout", (req, res) => {
    refreshTokens = refreshTokens.filter(c => c != req.body.token);
    res.status(204).send("Logged out!");
});

app.post("/addevent", (req, res) => {
    const { eventname, startdate, enddate, desc, type, location, eventlink, email } = req.body;

    db.getConnection(async (err, connection) => {
        if (err) throw (err);
        const finduserid = "SELECT uid FROM user WHERE email = ?";
        const search_query = mysql.format(finduserid, [email]);

        connection.query(search_query, (err, result) => {
            if (err) throw (err);
            const user_id = result[0].uid;

            const sqlInsert = "INSERT INTO event (eventname, startdate, enddate, `desc`, type, location, eventlink, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)";
            const insert_query = mysql.format(sqlInsert, [eventname, startdate, enddate, desc, type, location, eventlink, user_id]);

            connection.query(insert_query, (err, result) => {
                connection.release();
                if (err) throw (err);
                res.send("Event created");
            });
        });
    });
});

app.post("/eventupdate", (req, res) => {
    const { email, eventname, startdate, enddate, desc, type, location, eventlink } = req.body;

    db.getConnection(async (err, connection) => {
        if (err) throw (err);
        const finduserid = "SELECT uid FROM user WHERE email = ?";
        const search_query = mysql.format(finduserid, [email]);

        connection.query(search_query, (err, result) => {
            if (err) throw (err);
            const user_id = result[0].uid;

            const sqlUpdateevent = "UPDATE event SET eventname = ?, startdate = ?, enddate = ?, `desc` = ?, type = ?, location = ?, eventlink = ? WHERE user_id = ?";
            const update_query = mysql.format(sqlUpdateevent, [eventname, startdate, enddate, desc, type, location, eventlink, user_id]);

            connection.query(update_query, (err, result) => {
                connection.release();
                if (err) throw (err);
                res.send("Event updated");
            });
        });
    });
});

app.post('/create-payment-intent', async (req, res) => {
    const { amount, currency } = req.body;

    try {
        const paymentIntent = await stripe.paymentIntents.create({
            amount: amount * 100,
            currency: currency,
        });
        res.status(200).send({
            clientSecret: paymentIntent.client_secret,
        });
    } catch (error) {
        res.status(500).send({
            error: error.message,
        });
    }
});

app.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
    const sig = req.headers['stripe-signature'];

    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    switch (event.type) {
        case 'payment_intent.succeeded':
            const paymentIntent = event.data.object;
            console.log(`PaymentIntent for ${paymentIntent.amount} was successful!`);
            break;
        default:
            console.log(`Unhandled event type ${event.type}`);
    }

    res.json({ received: true });
});

// Add event to favorites
app.post("/favorite", (req, res) => {
    const { email, event_id } = req.body;

    db.getConnection(async (err, connection) => {
        if (err) throw (err);
        const finduserid = "SELECT uid FROM user WHERE email = ?";
        const search_query = mysql.format(finduserid, [email]);

        connection.query(search_query, (err, result) => {
            if (err) throw (err);
            const user_id = result[0].uid;

            const sqlInsert = "INSERT INTO favorites (user_id, event_id) VALUES (?, ?)";
            const insert_query = mysql.format(sqlInsert, [user_id, event_id]);

            connection.query(insert_query, (err, result) => {
                connection.release();
                if (err) throw (err);
                res.send("Event added to favorites");
            });
        });
    });
});

// Get user's favorite events
app.get("/favorites", (req, res) => {
    const { email } = req.query;

    db.getConnection(async (err, connection) => {
        if (err) throw (err);
        const finduserid = "SELECT uid FROM user WHERE email = ?";
        const search_query = mysql.format(finduserid, [email]);

        connection.query(search_query, (err, result) => {
            if (err) throw (err);
            const user_id = result[0].uid;

            const sqlSelect = "SELECT event.* FROM event INNER JOIN favorites ON event.eid = favorites.event_id WHERE favorites.user_id = ?";
            const select_query = mysql.format(sqlSelect, [user_id]);

            connection.query(select_query, (err, result) => {
                connection.release();
                if (err) throw (err);
                res.json(result);
            });
        });
    });
});

// Add event to bookmarks
app.post("/bookmark", (req, res) => {
    const { email, event_id } = req.body;

    db.getConnection(async (err, connection) => {
        if (err) throw (err);
        const finduserid = "SELECT uid FROM user WHERE email = ?";
        const search_query = mysql.format(finduserid, [email]);

        connection.query(search_query, (err, result) => {
            if (err) throw (err);
            const user_id = result[0].uid;

            const sqlInsert = "INSERT INTO bookmarks (user_id, event_id) VALUES (?, ?)";
            const insert_query = mysql.format(sqlInsert, [user_id, event_id]);

            connection.query(insert_query, (err, result) => {
                connection.release();
                if (err) throw (err);
                res.send("Event bookmarked");
            });
        });
    });
});

// Get user's bookmarked events
app.get("/bookmarks", (req, res) => {
    const { email } = req.query;

    db.getConnection(async (err, connection) => {
        if (err) throw (err);
        const finduserid = "SELECT uid FROM user WHERE email = ?";
        const search_query = mysql.format(finduserid, [email]);

        connection.query(search_query, (err, result) => {
            if (err) throw (err);
            const user_id = result[0].uid;

            const sqlSelect = "SELECT event.* FROM event INNER JOIN bookmarks ON event.eid = bookmarks.event_id WHERE bookmarks.user_id = ?";
            const select_query = mysql.format(sqlSelect, [user_id]);

            connection.query(select_query, (err, result) => {
                connection.release();
                if (err) throw (err);
                res.json(result);
            });
        });
    });
});

// Handling Errors
app.use((err, req, res, next) => {
    err.statusCode = err.statusCode || 500;
    err.message = err.message || "Internal Server Error";
    res.status(err.statusCode).json({
      message: err.message,
    });
});

app.listen(port, () => console.log(`Server is running on port ${port}`));
