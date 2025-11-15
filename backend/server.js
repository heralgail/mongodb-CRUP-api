const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const { ObjectId } = require('mongoose').Types; // Import for validation

const app = express();
const PORT = 5000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
mongoose.connect("mongodb+srv://heragail:1234ian@cluster0.y2h57ud.mongodb.net/?appName=Cluster0")
.then(() => {
    console.log("✅ MongoDB connected successfully!");
})
.catch(err => {
    console.error("❌ MongoDB connection failed:", err);
    process.exit(1); 
});

// =========================================================
//                   --- SCHEMAS & MODELS ---
// =========================================================

// 1. User Schema & Model (Existing)
const UserSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['customer', 'admin'], default: 'customer' }
});

const User = mongoose.model("User", UserSchema);


// 2. PRODUCT Schema & Model (Existing)
const ProductSchema = new mongoose.Schema({
    name: { type: String, required: true },
    price: { type: Number, required: true },
    amount: { type: Number, required: true, default: 0 }, 
    img: { type: String, default: 'images/default.jpg' } 
});

const Product = mongoose.model("Product", ProductSchema);


// =========================================================
//                   --- USER & AUTH ROUTES ---
// =========================================================

// *********** AUTHENTICATION ROUTES ***********

// 1. Admin Initial Setup (POST)
app.post("/api/admin/setup", async (req, res) => {
    try {
        const { name, email, password } = req.body;
        const adminExists = await User.findOne({ role: 'admin' });
        if (adminExists) {
            return res.status(403).json({ message: "Admin user already exists. Setup blocked." });
        }
        const newAdmin = new User({ name, email, password, role: 'admin' });
        await newAdmin.save();
        res.status(201).json({ message: "Admin user created successfully!", user: newAdmin });
    } catch (err) {
        res.status(500).json({ error: "Failed to create admin", details: err.message });
    }
});

// 2. Customer Sign-Up (Create - POST)
app.post("/api/register", async (req, res) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
        return res.status(400).json({ message: "Missing required fields (name, email, password)." });
    }
    try {
        const newUser = new User({ name, email, password, role: 'customer' });
        await newUser.save();
        // Respond with success and user info (excluding password)
        res.status(201).json({ id: newUser._id, name: newUser.name, email: newUser.email, role: newUser.role });
    } catch (err) {
        if (err.code === 11000) { 
            return res.status(409).json({ message: "This email address is already registered." });
        }
        res.status(500).json({ error: "Failed to create user account", details: err.message });
    }
});

// 3. Admin Login (POST)
app.post("/api/admin/login", async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ email, role: 'admin' });

        if (!user || user.password !== password) {
            return res.status(401).json({ message: "Invalid credentials or not an admin." });
        }
        res.json({ message: "Admin login successful", user: user.name, role: user.role });
    } catch (err) {
        res.status(500).json({ error: "Login failed", details: err.message });
    }
});

// 4. CUSTOMER LOGIN (POST) - 🎉 NEW FEATURE
app.post("/api/login", async (req, res) => {
    const { email, password } = req.body;
    
    try {
        // Find user where email matches AND role is 'customer' (or not 'admin')
        const user = await User.findOne({ email, role: 'customer' });

        if (!user) {
            return res.status(404).json({ message: "User not found or role mismatch." });
        }
        
        if (user.password !== password) {
            // NOTE: In a real app, you would use a hashed password comparison (e.g., bcrypt)
            return res.status(401).json({ message: "Invalid password." });
        }

        // Login successful!
        res.json({ 
            message: "Login successful", 
            id: user._id,
            name: user.name, 
            email: user.email,
            role: user.role
        });

    } catch (err) {
        res.status(500).json({ error: "Login failed", details: err.message });
    }
});


// *********** ADMIN DASHBOARD USER CRUD ROUTES ***********

// 5. READ All Users (GET)
app.get("/api/users", async (req, res) => {
    try {
        const users = await User.find().select('-password -__v');
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch user data", details: err.message });
    }
});

// 6. UPDATE User (PUT)
app.put("/api/users/:id", async (req, res) => {
    const { id } = req.params;
    const { name, email, role } = req.body; 
    
    if (!ObjectId.isValid(id)) {
        return res.status(400).json({ message: "Invalid User ID format." });
    }

    try {
        const updatedUser = await User.findByIdAndUpdate(
            id,
            { name, email, role },
            { new: true, runValidators: true }
        ).select('-password -__v');
        
        if (!updatedUser) {
            return res.status(404).json({ message: "User not found." });
        }
        
        res.json(updatedUser);
    } catch (err) {
        if (err.code === 11000) { 
            return res.status(409).json({ message: "Email already exists." });
        }
        res.status(500).json({ error: "Failed to update user", details: err.message });
    }
});

// 7. DELETE User (DELETE)
app.delete("/api/users/:id", async (req, res) => {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
        return res.status(400).json({ message: "Invalid User ID format." });
    }
    
    try {
        const deletedUser = await User.findByIdAndDelete(id);

        if (!deletedUser) {
            return res.status(404).json({ message: "User not found." });
        }
        res.status(200).json({ message: "User deleted successfully", id });
    } catch (err) {
        res.status(500).json({ error: "Failed to delete user", details: err.message });
    }
});


// =========================================================
//                   --- PRODUCT CRUD ROUTES ---
// =========================================================

// 8. CREATE Product (POST)
app.post("/api/products", async (req, res) => {
    try {
        const newProduct = new Product(req.body);
        await newProduct.save();
        res.status(201).json(newProduct);
    } catch (err) {
        res.status(500).json({ error: "Failed to create product", details: err.message });
    }
});

// 9. READ All Products (GET)
app.get("/api/products", async (req, res) => {
    try {
        const products = await Product.find();
        res.json(products);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch products", details: err.message });
    }
});

// 10. UPDATE Product (PUT)
app.put("/api/products/:id", async (req, res) => {
    const { id } = req.params;
    const { name, price, amount, img } = req.body; 

    try {
        const updatedProduct = await Product.findByIdAndUpdate(
            id,
            { name, price, amount, img }, 
            { new: true, runValidators: true } 
        );
        
        if (!updatedProduct) {
            return res.status(404).json({ message: "Product not found." });
        }
        
        res.json(updatedProduct);
    } catch (err) {
        res.status(500).json({ error: "Failed to update product", details: err.message });
    }
});

// 11. DELETE Product (DELETE)
app.delete("/api/products/:id", async (req, res) => {
    const { id } = req.params;
    
    try {
        const deletedProduct = await Product.findByIdAndDelete(id);

        if (!deletedProduct) {
            return res.status(404).json({ message: "Product not found." });
        }
        res.status(200).json({ message: "Product deleted successfully", id });
    } catch (err) {
        res.status(500).json({ error: "Failed to delete product", details: err.message });
    }
});


// Start Server
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
