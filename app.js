require('dotenv').config();
const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const ejs = require("ejs");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const session = require("express-session");
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const findOrCreate = require('mongoose-findorcreate');
const flash = require("req-flash");

const app =  express();
app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({extended: true}));
app.use(express.static("public"));
mongoose.set("strictQuery", false);

app.use(session ({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true
}));

app.use(flash());

app.use(passport.initialize());
app.use(passport.session());

mongoose.connect("mongodb://127.0.0.1:27017/doitDB");

const todoSchema = new mongoose.Schema ({
    content: String
});


const userSchema = new mongoose.Schema ({
    username: String,
    password: String,
    googleId: String,
    todos: [todoSchema],
    notes: []
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const Todo = mongoose.model("Todo", todoSchema);
const User = new mongoose.model("User", userSchema);


passport.use(User.createStrategy());

passport.serializeUser(function(user, done) {
    done(null, user.id);
  });
  
passport.deserializeUser(function(id, done) {
    User.findById(id, function (err, user) {
      done(err, user);
    });
  });

  // --------- Google Authentication OAUTH20  ---------

passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:100/auth/google/main"
  },
  function(accessToken, refreshToken, profile, cb) {
    User.findOrCreate({username: profile.emails[0].value, googleId: profile.id}, function (err, user) {
      return cb(err, user);
    });
  }
));

app.get("/auth/google",
  passport.authenticate('google', { scope: ['profile', 'email'] }));

app.get("/auth/google/main", 
  passport.authenticate('google', { failureRedirect: "/" }),
  function(req, res) {
    res.redirect('/main');
  });


// :::::::::::::::::::::::::::::::::::  C R U D ::::::::::::::::::::::::::::::::::::::::::::: //



// Notes: "/" = Login Route
// ************* LOGIN ROUTE **********

app.route("/")
.get(function (req, res) {
    res.render("login");
})
.post(function (req, res) {
    const user = new User ({
        username: req.body.username,
        password: req.body.password
    });

    req.login(user, function(err, user) {
        if (err) {
            console.log(err);
        } else {
        passport.authenticate("local", {failureRedirect: "/register"})(req, res, function() {
            res.redirect("/main");
        });
        };
    });
});


// ************* REGISTER ROUTE **********
app.route("/register")
.get(function (req, res) {
    res.render("register", {message: req.flash('errorMessage')});
})
.post(function(req, res) {
    User.register({username: req.body.username}, req.body.password, function(err, user) {
        if (err) {
            console.log(err);
            req.flash('errorMessage', "This username already exist, try another one!");
            res.redirect("/register");
        } else {
            passport.authenticate("local")(req, res, function() {
            res.redirect("/main");
            });
        };
    });
});


// ************* MAIN ROUTE **********


app.route("/main")
.get(async (req, res) => {
    // Motivational Quotes Generator API
    var quotes = "";
    var author = "";

    await fetch("https://type.fit/api/quotes")
    .then(function(response) {
    return response.json();
    })
    .then(function(data) {
    const totalQuotes = data.length;
    const i = Math.floor(Math.random() * totalQuotes);
    quotes = data[i].text;
    author = data[i].author;
    });

    if (req.isAuthenticated()) {
        User.findById(req.user.id, function(err, foundUser) {
            const todoContent = foundUser.todos;
            res.render("main", {quotes: quotes, author: author, todoList: todoContent} );
        });
    } else {
        res.redirect("/");
    };
})
.post(function(req, res) {
    const newTodo = new Todo ({
        content: req.body.newTodo
    });

    User.findById(req.user.id, function(err, foundUser) {
        foundUser.todos.push(newTodo);
        foundUser.save();
        res.redirect("/main");
    } );
    
});

// ************* MAIN ROUTE **********

app.post("/delete", function(req, res) {
    const checkedTodo = req.body.checkbox;

    User.findByIdAndUpdate(req.user.id,
        {$pull: {todos: {_id: checkedTodo}}},
        function(err, done) {
            if (err) {
                console.log(err);
            } else {
                res.redirect("/main");
            };
        });
});

// ************* OTHER ROUTE **********

app.get("/create", function(req, res) {
    res.render("create");
});

app.get("/logout", function(req, res) {
    req.logout(function(err) {
        if (err) {
            console.log(err);
        } else {
            res.redirect("/");
        }
    })
});



app.listen(100, function (req, res) {
    console.log("Server is running on port 100!");
});