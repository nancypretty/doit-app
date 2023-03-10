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
const _ = require("lodash");

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

const noteSchema = new mongoose.Schema ({
    title: String,
    content: String
});


const userSchema = new mongoose.Schema ({
    username: String,
    password: String,
    googleId: String,
    todos: [todoSchema],
    notes: [noteSchema]
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const Todo = mongoose.model("Todo", todoSchema);
const Note = mongoose.model("Note", noteSchema);
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


// ************* MAIN ROUTE/PAGE FUNCTION **********


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
            const todoContent = foundUser.todos; // finding todos list
            const noteContent = foundUser.notes;
            res.render("main", {quotes: quotes, author: author, todoList: todoContent, noteList: noteContent, message: req.flash('maxMessage')} );
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

// Delete if checkbox in Todo-List got checked.
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

// Create new notes.
app.route("/create")
.get(function(req, res) {

    User.findById(req.user.id, function(err, foundUser) {
        if (foundUser.notes.length === 3) {
            req.flash('maxMessage', "Sorry, but you can only add 3 notes for now. :(");
            res.redirect("/main");
        } else {
            res.render("create");
        }
    });
})
.post(function(req, res) {

    const newNote = new Note ({
        title: req.body.title,
        content: req.body.content
    });

    User.findById(req.user.id, function(err, foundUser) {
        foundUser.notes.push(newNote);
        foundUser.save();
        res.redirect("/main");
    });
});

// Directing to a spesific note.
app.route("/notes/:direct")
.get(function(req, res) {
    const noteRoute = _.lowerCase(req.params.direct);

    User.findById(req.user.id, function(err, foundUser) {
    const notes = foundUser.notes;

    notes.forEach(note => {
        const theTitle = _.lowerCase(note.title);

        if (theTitle === noteRoute) {
            res.render("note", {
                title: note.title,
                content: note.content,
                id: note._id
            });
        };
    });

    });
})
.post(function(req, res) { // Deleting spesific note.
    const deleteNote = req.body.noteId;

    User.findByIdAndUpdate(req.user.id,
        {$pull: {notes: {_id: deleteNote}}},
        function(err, done) {
            if (err) {
                console.log(err);
            } else {
                res.redirect("/main");
            };
        });

})

// Logout
app.get("/logout", function(req, res) {
    req.logout(function(err) {
        if (err) {
            console.log(err);
        } else {
            res.redirect("/");
        }
    })
});


  // ----------------- Server Port ------------------

app.listen(100, function (req, res) {
    console.log("Server is running on port 100!");
});