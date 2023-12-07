const mongoose = require('mongoose')
const imageSchema = require('./image.js')

const productSchema = new mongoose.Schema({
    name : {type: String,
    required: true},
    description : String,
    image: { type: mongoose.Schema.Types.ObjectId, ref: 'Image' },
    stock : String
})

module.exports = productSchema