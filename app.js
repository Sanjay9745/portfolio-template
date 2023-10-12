require("dotenv").config()
const express = require('express');
const app = express();
const session = require("express-session");
const cookieParser = require("cookie-parser");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const pdf = require('html-pdf');
const ejs = require('ejs');
const fs = require('fs');

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
    skills: [String], // An array to store skills
    about: String,
    email: String,
    phone: String,
    cvLink: String,
    projects: [{
        image: String,
        projectName: String,
        projectLink: String
    }] // An array of project objects
});


const User = mongoose.model("User", userSchema);

const auth = (req, res, next) => {
    if (req.session.username) {
        next();
    } else {
        res.redirect("/login");
    }
}

app.get("/",auth,(req,res)=>{
    res.render("form",{username:req.session.username})
})
app.get("/login",(req,res)=>{
    res.render("login",{error:""})
})
app.get("/register",(req,res)=>{
    res.render("register",{error:""})
})
app.get("/:username",async(req,res)=>{
    const {username} = req.params;
    const user =await User.findOne({username});
    if(!user){
        return res.render("login",{error:""})
    }
    const {name,logo,skills,about,email,phone,cvLink,projects} = user
    res.render("preview",{name,logo,skills,about,email,phone,cvLink,projects})
})

app.post("/register",async(req,res)=>{
    try {
        
        const {username,password} = req.body;
        const user = await User.findOne({username:username});
        if(user){
            return res.render("register",{error:"User Already Exist"})
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
            return res.render("login",{error:"No user found"})
        }
        const isMatch = await bcrypt.compare(password,user.password);
        if(!isMatch){
            return res.render("login",{error:"Wrong Password"})
        }
        req.session.username = user.username;
        res.redirect("/");

    } catch (error) {
        res.status(500).json({message:"Something went wrong"})
    }
})
app.post("/form", async (req, res) => {
    const formData = req.body;

    try {
        // Find the user by username
        const user = await User.findOne({ username: req.session.username });

        if (!user) {
            return res.status(404).send("User not found");
        }
        if (formData.skills && formData.skills.some(skill => skill === "")) {
            formData.skills = user.skills;
        } 
        if (formData.projects) {
            const hasEmptyProject = formData.projects.some(project => {
                return project.image === "" || project.projectName === "" || project.projectLink === "";
            });
        
            if (hasEmptyProject) {
                formData.projects = user.projects;
            }
        }

        // Update user properties based on form data
        for (const key in formData) {
            const value = formData[key];

            // Skip updating if the value is an empty string
            if (value === "") {
                continue;
            }

            if (key === "skills") {
                // Handle skills as an array
                user.skills = Array.isArray(value) ? value : [value];
            } else if (key.startsWith("projects[")) {
                // Handle projects as an array of objects
                const projectIndex = key.match(/\d+/)[0];
                if (!user.projects) {
                    user.projects = [];
                }

                // Check if the project at the specified index exists
                if (!user.projects[projectIndex]) {
                    user.projects[projectIndex] = {};
                }

                // Update the project properties
                for (const subKey in value) {
                    // Skip updating if the subValue is an empty string
                    if (value[subKey] !== "") {
                        user.projects[projectIndex][subKey] = value[subKey];
                    }
                }
            } else {
                // Handle other fields
                user[key] = value;
            }
        }

        // Remove any undefined projects from the array
        user.projects = user.projects.filter(Boolean);

        // Save the updated user data to the database
        await user.save();
       
        res.redirect("/" + req.session.username);
    } catch (error) {
        res.status(500).json({ message: "Something went wrong" });
    }
});


app.get("/pdf/:username", async (req, res) => {
    const { username } = req.params;
    const user = await User.findOne({ username });
    
    if (!user) {
      return res.render("login", { error: "" });
    }
  
    const { name, logo, skills, about, email, phone, cvLink, projects } = user;
  
    // Render the EJS template with the data
    ejs.renderFile('./views/preview.ejs', { name, logo, skills, about, email, phone, cvLink, projects }, (err, html) => {
      if (err) {
        console.error(err);
        return res.status(500).send('Error rendering EJS template');
      }
  
      // Create a temporary HTML file
      const tempHtmlFile = 'temp.html';
      fs.writeFileSync(tempHtmlFile, html);
  
      // Define the PDF options
      const pdfOptions = {
        format: 'Letter',
        orientation: 'portrait',
        base: 'file://' + __dirname + '/public' // This assumes your CSS file is in the public directory
      };
  
      // Generate the PDF
      pdf.create(html, pdfOptions).toFile('output.pdf', (pdfErr, pdfRes) => {
        if (pdfErr) {
          console.error(pdfErr);
          return res.status(500).send('Error generating PDF');
        }
  
        // Serve the generated PDF as a download
        res.setHeader('Content-Disposition', 'attachment; filename=preview.pdf');
        res.setHeader('Content-type', 'application/pdf');
        fs.createReadStream('output.pdf').pipe(res);
      });
    });
  });

  
  const customCss = fs.readFileSync('public/css/style.css', 'utf8');

  // Your route to generate and send HTML to the user
  app.get("/generate/:username", async (req, res) => {
    const { username } = req.params;
    const user = await User.findOne({ username });
  
    if (!user) {
      return res.render("login", { error: "" });
    }
  
    const { name, logo, skills, about, email, phone, cvLink, projects } = user;
  
    // Render the EJS template with the data
    ejs.renderFile('./views/preview.ejs', { name, logo, skills, about, email, phone, cvLink, projects }, (err, html) => {
      if (err) {
        console.error(err);
        return res.status(500).send('Error rendering EJS template');
      }
  
      // Combine the HTML and the custom CSS
      const combinedHtml = `
        <html>
        <head>
          <style>${customCss}
          
          </style>
        </head>
        <body>
          ${html}
        </body>
        </html>
      `;
  
      // Send the combined HTML to the user 
      res.setHeader('Content-Disposition', 'attachment; filename=generated.html');
      res.setHeader('Content-type', 'text/html');
      res.send(combinedHtml);
    });
  });
app.listen(3000,(err)=>{
if(err){
    console.log("error occured")
}
console.log("Server Running on Port 3000")
})
