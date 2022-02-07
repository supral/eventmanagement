// getting port from .env file
require("dotenv").config()
const express = require('express');
// using bcrypt to store hashed passwords in our DB
const bcrypt = require("bcrypt");
//the generateAccessToken function
const jwt = require("jsonwebtoken");
const generateAccessToken = require("./generateAccessToken");
const generateRefreshToken = require("./generateRefreshToken");

// connecting to dbconnection.js file for database connection
const DB_HOST = process.env.DB_HOST
const DB_USER = process.env.DB_USER
const DB_PASSWORD = process.env.DB_PASSWORD
const DB_DATABASE = process.env.DB_DATABASE
const port = process.env.PORT

var mysql = require('mysql');
const { add, result } = require("lodash");
var db = mysql.createPool({
  host: DB_HOST, // your host name
  user: DB_USER,      // your database username
  password: DB_PASSWORD,      // your database password
  database: DB_DATABASE // // your database Name
}); 
 
db.getConnection( (err, connection)=> {
    if (err) throw (err)
    console.log ("DB connected successful: " + connection.threadId)
})


// initializing app variable with express
const app = express();

// express. json() is a method inbuilt in express to recognize the incoming Request Object as a JSON Object.
// middleware to read req.body.<params>
app.use(express.json());



// registeration of user
app.post("/register", async (req,res) => {
    const fname = req.body.fname;
    console.log(fname)
    const lname = req.body.lname;
    const email = req.body.email;
    const phone = req.body.phone;
    const hashedPassword = await bcrypt.hash(req.body.password,10);
    const username = req.body.username;

    db.getConnection( async (err, connection) => {
     if (err) throw (err)
     const sqlSearch = "SELECT * FROM user WHERE email = ?"
     const search_query = mysql.format(sqlSearch,[email])
     const sqlInsert = "INSERT INTO user VALUES (0,?,?,?,?,?,?)"
     const insert_query = mysql.format(sqlInsert,[fname, lname, email, phone, hashedPassword, username])

     await connection.query (search_query, async (err, result) => {
      if (err) throw (err)
      console.log("------> Search Results")
      console.log(result.length)
      if (result.length != 0) {
       connection.release()
       console.log("------> User already exists")
       res.sendStatus(409) 
      } 
      else {
       await connection.query (insert_query, (err, result)=> {
       connection.release()
       if (err) throw (err)
       console.log ("--------> Created new User")
       console.log(result.insertId)
       res.sendStatus(201)
      })
     }
    }) //end of connection.query()
    }) //end of db.getConnection()
    }) //end of app.post()




// login user
app.post("/login", (req, res)=> {
    const email = req.body.email
    const password = req.body.password
    db.getConnection ( async (err, connection)=> {
     if (err) throw (err)
     const sqlSearch = "SELECT * FROM user WHERE email = ?"
     const search_query = mysql.format(sqlSearch,[email])
     await connection.query (search_query, async (err, result) => {
      connection.release()
      
      if (err) throw (err)
      if (result.length == 0) {
       console.log("--------> User does not exist")
       res.sendStatus(404)
      } 
      else {
         const hashedPassword = result[0].password
         //get the hashedPassword from result
        if (await bcrypt.compare(password, hashedPassword)) {
        console.log("---------> Login Successful")
        res.send(`${email} is logged in!`)
        console.log("---------> Generating accessToken")
        const accessToken = generateAccessToken ({user: req.body.email})
        const refreshToken = generateRefreshToken ({user: req.body.email})   
        // console.log(accessToken)
        // console.log(refreshToken)
        res.json({accessToken: accessToken})
        res.json({accessToken: refreshToken})
        } 
        else {
        console.log("---------> Password Incorrect")
        res.send("Password incorrect!")
        } //end of bcrypt.compare()
      }//end of User exists i.e. results.length==0
     }) //end of connection.query()
    }) //end of db.connection()
    }) //end of app.post()


// change password
app.post("/changepassword", async (req, res)=> {
    const email = req.body.email
    const password = await bcrypt.hash(req.body.password,10);
    db.getConnection ( async (err, connection)=> {
        if (err) throw (err)
        const sqlSearch = "SELECT * FROM user WHERE email = ?"
        const search_query = mysql.format(sqlSearch,[email])
        const sqlUpdate = "UPDATE `user` SET `password` = ? WHERE `email` = ?;"
        const update_query = mysql.format(sqlUpdate,[ email, password])
        await connection.query (search_query, async (err, result) => {
            connection.release()
            
            if (err) throw (err)
            if (result.length == 0) {
             console.log("--------> User does not exist")
             res.sendStatus(404)
            }
            else{
                await connection.query (update_query, (req,res) =>{
                    connection.release()
                    if (err) throw (err)
                    console.log("--------> User password updated")
                    res.sendStatus(200)
                })
            }
        }) 
    })
})


//REFRESH TOKEN API
app.post("/refreshToken", (req,res) => {
    if (!refreshTokens.includes(req.body.token)) 
        res.status(400).send("Refresh Token Invalid")
        refreshTokens = refreshTokens.filter( (c) => c != req.body.token)
        //remove the old refreshToken from the refreshTokens list
        const accessToken = generateAccessToken ({user: req.body.name})
        const refreshToken = generateRefreshToken ({user: req.body.name})
        //generate new accessToken and refreshTokens
        res.json ({accessToken: accessToken, refreshToken: refreshToken})
})


// logging out
app.delete("/logout", (req,res)=>{
    refreshTokens = refreshTokens.filter( (c) => c != req.body.token)
    //remove the old refreshToken from the refreshTokens list
    res.status(204).send("Logged out!")
})


// adding event to database
app.post("/addevent", (res, req)=>{
    console.log("inside addevent function")
    const eventname = req.body.eventname;
    console.log(eventname);
    const startdate = req.body.startdate;
    const enddate = req.body.enddate;
    const desc = req.body.desc;
    const type = req.body.type;
    const location = req.body.location;
    const eventlink = req.body.eventlink;
    const email = req.body.email;

    db.getConnection( async (err, connection) => {
        if (err) throw (err)
        var user_id
        const finduserid = "SELECT uid FROM user WHERE email=?"
        const search_query = mysql.format(finduserid,[email])
        connection.query(search_query, (err, result)=>{
            if (err) throw (err)
            else setvalue(result)
        });
        function setvalue(result) {
            user_id = result;
        }

        const sqlInsert = "INSERT INTO event VALUES (0,?,?,?,?,?,?,?,?)"
        const insert_query = mysql.format(sqlInsert,[eventname, startdate, enddate, desc, type, location, eventlink, user_id])

        connection.query(insert_query, (err, result)=>{
            connection.release()
            if (err) throw (err)
            res.send("-------> event created")
        })

    })
})

// Handling Errors
app.use((err, res) => {
    // console.log(err);
    err.statusCode = err.statusCode || 500;
    err.message = err.message || "Internal Server Error";
    res.status(err.statusCode).json({
      message: err.message,
    });
});
 
app.listen(port,() => console.log('Server is running on port 3000'));