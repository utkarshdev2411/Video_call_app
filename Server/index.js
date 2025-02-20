const express = require('express');
const app = express();
const port = process.env.port || 3000;
require('dotenv').config();
require('./config/db.js'); 

app.get('/', (req, res) => {
    res.status(200).json({ status: 'Welcome to App' });
});

app.listen(port, () => {
    console.log(`Server started on port ${port}`);
});