const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const messageSchema = new Schema({
    chat: {
        type : Schema.Types.ObjectId,//chat id's
        ref : 'Chat',
        required : true,
    },
    sender:{
        type: Schema.Types.ObjectId,//sender's id
        ref : 'User',
        required: true,
    },
    content : {
        type : String,
        required : true,
    },
    readBy : [{
            user : {
                type : Schema.Types.ObjectId,//receiver's id
                ref : 'User'
            },
            readAt : {
                type : Date,
                default : Date.now(),
            },
        }],
    allUserRead : {
        type: Boolean,
        default:false,
    },
    deleted:{
        type:Boolean,
        default:false,
    },
    deletedBy:[{
        type:Schema.Types.ObjectId,
        ref:'User'
    }],
}, {
    timestamps : true
});

module.exports = mongoose.model("Message", messageSchema);
