require("dotenv").config()
const express = require('express');
const app = express();
const session = require("express-session");
const cookieParser = require("cookie-parser");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");



app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));
app.set("view engine", "ejs");
app.use(cookieParser());
app.use(session({
    secret: process.env.SECRET,
    resave: false,
    saveUninitialized: true
}));
mongoose.connect(process.env.MONGODB_URI);
const db = mongoose.connection;
db.on("error", console.error.bind(console, "connection error:"));
db.once("open", function () {
    console.log("we are connected");
});
const userSchema = new mongoose.Schema({
    username: String,
    password: String,
    name: String,
    logo: String,
    skill1: String,
    skill2: String,
    skill3: String,
    about: String,
    email: String,
    phone: String,
    cvLink: String,

})

const User = mongoose.model("User", userSchema);

const auth = (req, res, next) => {
    if (req.session.username) {
        next();
    } else {
        res.redirect("/login");
    }
}

app.get("/",auth,(req,res)=>{
    res.render("form")
})
app.get("/login",(req,res)=>{
    res.render("login")
})
app.get("/register",(req,res)=>{
    res.render("register")
})
app.get("/:username",async(req,res)=>{
    const {username} = req.params;
    const user =await User.findOne({username});
    if(!user){
        return res.status(404).send("User not found")
    }
    const {name,logo,skill1,skill2,skill3,about,email,phone,cvLink} = user
    res.render("preview",{name,logo,skill1,skill2,skill3,about,email,phone,cvLink})
})

app.post("/register",async(req,res)=>{
    try {
        
        const {username,password} = req.body;
        const user = await User.findOne({username:username});
        if(user){
            return res.status(400).send("Username already exists")
        }
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password,salt);
        const newUser = new User({username,password:hashedPassword});
        await newUser.save();

        req.session.username = username;
        res.redirect("/");

    } catch (error) {
        res.status(500).json({message:"Something went wrong"})
    }
})

app.post("/login",async(req,res)=>{
    try {
        const {username,password} = req.body;
        const user = await User.findOne({username});
        if(!user){
            return res.status(404).send("Username not Exist")
        }
        const isMatch = await bcrypt.compare(password,user.password);
        if(!isMatch){
            return res.status(401).send("Wrong Password")
        }
        req.session.username = user.username;
        res.redirect("/");

    } catch (error) {
        res.status(500).json({message:"Something went wrong"})
    }
})

app.post("/form",auth,async(req,res)=>{
    try {
        const {name,logo,skill1,skill2,skill3,about,email,phone,cvLink} = req.body;
        const user = await User.findOne({username:req.session.username});
        if(!user){
            return res.status(404).send("User not found")
        }
        user.name = name;
        user.logo = logo;
        user.skill1 = skill1;
        user.skill2 = skill2;
        user.skill3 = skill3;
        user.about= about;
        user.email = email;
        user.phone = phone;
        user.cvLink=cvLink;
        await user.save();
        res.redirect("/"+req.session.username)

    } catch (error) {
        res.status(500).json({message:"Something went wrong"})
    }
})
app.listen(3000,(err)=>{
if(err){
    console.log("error occured")
}
console.log("Server Running on Port 3000")
})

