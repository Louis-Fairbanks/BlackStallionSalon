const mongoose = require('mongoose')

const productSchema = new mongoose.Schema({
    name : {type: String,
    required: true},
    description : String,
    image: { type: mongoose.Schema.Types.ObjectId, ref: 'Image' },
    stock : String,
    imageUrl : String,
})

module.exports = productSchema