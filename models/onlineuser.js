const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const onlineSchema = new Schema({
    userId:{
        type:Schema.ObjectId,
        ref:'User',
        required:true,
    },
    socketId:{
        type:String,
        required:true,
    },
    lastActive:{
        type:Date,
        default:Date.now()
    },
   
});

module.exports = mongoose.model("Online", onlineSchema);