const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const ejs = require("ejs");

const app =  express();
app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({extended: true}));
app.use(express.static("public"));

app.get("/", function (req, res) {
    res.render("login");
});

app.get("/register", function (req, res) {
    res.render("register");
});

app.get("/main", function(req, res) {
    fetch("https://type.fit/api/quotes")
    .then(function(response) {
    return response.json();
    })
    .then(function(data) {
        const totalQuotes = data.length;
        const i = Math.floor(Math.random() * totalQuotes);
        const quotes = data[i].text;
        const author = data[i].author;
        res.render("main", {quotes: quotes, author: author} );
     });

});

app.get("/create", function(req, res) {
    res.render("create");
});


app.get("/logout", function(req, res) {
    res.redirect("/");
});













app.listen(100, function (req, res) {
    console.log("Server is running on port 100!");
});