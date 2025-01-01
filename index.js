require('dotenv').config()

const express = require("express");
const mongoose = require("mongoose");
const Mongo_URL = "mongodb://127.0.0.1:27017/ChatApp";
const cors = require('cors');
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const cookieParser = require('cookie-parser');
const { ObjectId } = require('mongodb'); 

const dbUrl = process.env.ATLASDB_URL;

// socket
const http = require('http');
const { Server } = require('socket.io');
const app = express();
const server = http.createServer(app);
// https://chat-connect-part-2.onrender.com
const io = new Server(server,{
    cors: {
        origin : "http://localhost:5173",
        credentials : true,
        methods : ["POST","GET"]
    }
});

// const io = new Server(server,{
//     cors: {
//         origin : "https://chat-connect-part-2.onrender.com",
//         credentials : true,
//         methods : ["POST","GET"]
//     }
// });

//cors
const corsOptions = {
    origin : "http://localhost:5173",
    credentials : true,
}

// const corsOptions = {
//     origin : "https://chat-connect-part-2.onrender.com",
//     credentials : true,
// }
app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());


//models
const User = require("./models/user.js");
const Message = require("./models/message.js");
const Chat = require("./models/chat.js");
const OnlineUser = require("./models/onlineuser.js");



//mongodb
main()
    .then(() => {
        console.log("Connected To DB");
    })
    .catch((err) => {
        console.log(err);
    })

async function main() {
    await mongoose.connect(dbUrl);
}
//routes

app.get('/',(req,res) => {
    res.send("hello i am root let url https:chat-connect-part-1.onrender.com");
});

//signup
app.post('/router/signup',async (req,res) => {
    console.log(req.body)
    try {
        if(req.body.data.email && req.body.data.password && req.body.data.username) {
            const usersEamilExist = await User.findOne({email:req.body.data.email});
            const usersUsernameExist = await User.findOne({username:req.body.data.username});
            if(usersUsernameExist || usersEamilExist) {
                return res.status(500).json({message:"Email and username already exist"})             
            }else {
                const hashSalt = await bcrypt.genSalt(10);
                const newPassword = await bcrypt.hash(req.body.data.password,hashSalt);
    
                const newUser = await User({username:req.body.data.username,email:req.body.data.email,password:newPassword});
                const savedUser = await newUser.save();
                const savedUserId = savedUser._id;
                const token = await jwt.sign({username:savedUserId},"helloiamnewincoding");
                savedUser.token = token;
                await savedUser.save();
    
                //cookies
                res.cookie('jwt', token, { 
                    secure: true, 
                    httpOnly : true, 
                    sameSite: 'none',
                    maxAge:3600000
                });
                // console.log(newUser);  
                res.status(200).json({message:"Sign up successfullly", token, user: {id:savedUser._id, email:savedUser.email,username:savedUser.username}});
            }
        } else {
            return res.status(500).json({message:"bad request"})
        }
    } catch (error) {
        // console.log(error);
        res.status(500).json({message:"Something Went Wrong"});
    }
});

//login
app.post('/router/login',async (req,res) => {
    try {
        if(req.body.data.email && req.body.data.password) {
            // console.log(req.body.data.email," + ", req.body.data.password);
            const userExist = await User.findOne({email:req.body.data.email});
            // console.log(userExist);
            if(!userExist) {
                return res.status(500).json({message:"Email not found"})
            }
    
            const comparedPassword = await bcrypt.compare(req.body.data.password,userExist.password); 
            if(comparedPassword) {
                const token = await jwt.sign({username:userExist._id},"helloiamnewincoding",{ expiresIn: '1h' } );
                userExist.token = token;
                await userExist.save();
    
                //cookies
                res.cookie('jwt', token, { 
                    secure: true, 
                    httpOnly : true, 
                    sameSite:'none',
                    // sameSite:'strict',
                    // expires : 3600000
                    maxAge:3600000
                });  
                res.status(200).json({message:"Login Successfully", token, user: {id:userExist._id, email:userExist.email,username:userExist.username}});
    
            } else {
                res.status(401).json({message:"Incorrect Password"});
            }
        }else {
            return res.status(500).json({message:"Something went wrong"})
        }
    } catch (error) {
        console.log(error);
        res.status(500).json({message:"Something went wrong"})
    }
});

//logout
app.post("/router/logout",(req,res) => {
    // console.log("/router/logout" ,"I am triggered");
    const removedCookie = res.clearCookie('jwt', {
                            secure: true,          
                            httpOnly: true,        
                            // sameSite: 'none',      
                            maxAge: 0             
                        });
    // console.log("/router/logout",removedCookie);
    if(removedCookie) {
        res.status(200).json({message:"You are logout"})
    } else {
        res.status(400).json({message:"Something went wrong"})
    }
});

/*
    ---> Authenciation Middlewares
*/

const userAuth = (req,res,next) => {
    const token = req.cookies.jwt;
    if(token) {
        jwt.verify(token,"helloiamnewincoding", (err,user) => {
            if(err) {
                return res.status(403).json({message:"You are not user of this"});
            }
            // console.log(user)
            req.user = user;
            next();
        });
        
    } else {
        res.status(401).json({message:"You are not login"})
    }
};

// frontend token sent

app.get('/router/authcontext',(req,res) => {
    const token = req.cookies.jwt;
    if(token) {
        jwt.verify(token,"helloiamnewincoding", (err,user) => {
            if(err) {
                return res.status(403).json({message:"You are not user of this"});
            }
            req.user = user;
            res.status(200).json({tokens:token,users:user})
        });
        
    } else {
        res.status(401).json({message:"You are not login"})
    }
})

//chat  chatList
app.post("/router/chats",userAuth, async(req,res) => {
    try {
        const chats = await Chat.find({'participants.user':req.body.data})
                        .populate('participants.user','username email')
                        .populate({
                            path:'messages',
                            populate:{path:'sender',select:'username email'}
                        });

        res.status(200).json(chats)
    } catch (error) {
        console.log(error)
        res.status(500).json({message:"Id wrong"})
    }
});

//searchEmail for chat begain!
app.post("/router/chats/serchEmail",userAuth, async(req,res) => {
    try {
        const userId = req.user.username;// online user
        const email = req.body.email;// receiver user
        const user = await User.findOne({email});

        if(!user || userId.toString() === user._id.toString() ) {
            return res.status(404).json({message:"User not found"})
        }
        res.status(200).json({message:"User Found",chatId:user._id,otherUser:user.username,email:user.email})
    } catch (error) {
        res.status(500).json({message:"Error in search message"})
    }
});

//start chat first time!
app.post("/router/chats/create",userAuth, async(req,res) => {
    try {
        const email = req.body.recipientEmail;
        const recipient = await User.findOne({email});
        if(!recipient) {
            return res.status(404).json({message:"RecipientEmail not found"})
        }
        let userId = new ObjectId(req.user.username)

        let chat = await Chat.findOne({
            $and: [{'participants.user':userId},{'participants.user':recipient._id}],
            isGroupChat:false,
        });  
        if(!chat) {
            chat = new Chat({
                participants:[{user:req.user.username,joinedAt:Date.now()},{user:recipient._id,joinedAt:Date.now()}],
                createdBy:req.user.username,
                isGroupChat:false,
            });
            await chat.save();
        }

        res.status(200).json({chat,message:"Start the chat"})
    } catch (error) {
        console.error(error)
        res.status(500).json({message:"Error in search message"})
    }
});


app.post('/router/chat/:id/messages',userAuth,async (req,res) => {
    const chatId = req.params.id; /// chat id  
    const userId = req.body.data; // user id

    // console.log(req.params);
    // console.log(req.body);
    // console.log(req.user.username)
     
    if(req.user.username == req.body.data) {
        try {
            let chats = await Chat.findById(chatId).populate('createdBy','username')
            .populate({path:'participants.user',select:'username'})
            .populate({
                path:'messages',
                populate:{path:'sender',select:'username email'}
            }).exec();
            // console.log(chats,"chats")
            if(!chats) {
                return res.status(404).json({message:"Chat not found"})
            }
            return res.status(200).json(chats)

        } catch (error) {
            // console.error(error)
            // console.log("eorrorsemvvkkvdskvn");
            return res.status(500).json("dsnvdskjn")
        }

    } else {
        res.status(500).json({message:"You are not user of this chat"})
    }
});

app.get('/router/users',userAuth,async (req,res) => {
    const users = await User.find({},'_id username email');
    // console.log(users);
    if(!users) {
        return res.status(500).json({message:'Users not found'})
    }
    res.status(200).json(users)
});

app.post("/router/create-group",userAuth,async(req,res) => {
    try {
        // console.log(req.body);
        const {groupName, createdBy, memberIds} = req.body;
        if(!groupName || !createdBy|| !Array.isArray(memberIds)) {
            return res.status(400).json({message:'Iinvalid Data'})
        }
        const members = [...new Set([createdBy,...memberIds])]
        const newGroupChat = new Chat({
            isGroupChat:true,
            participants:members.map(member => ({user:member,joinedAt:Date.now()})),
            groupName,   
            createdBy,         
        })
        await newGroupChat.save();
        res.status(200).json({newGroupChat,message:"Group Created"})
    } catch (error) {
        res.status(500).json({message:"Something went wrong"})
        console.error(error);
    }
});

app.post("/router/deleteForMe",userAuth,async(req,res) => {
    let {messagesIds, chatId} = req.body;
    // console.log(messagesIds,chatId)
    const userId = req.user.username; // user id
    // console.log(userId)
    try {
        if(!messagesIds,!chatId) {
            return res.status(500).json({message:"Invalid data"})
        }
        let chatAvailable = await Chat.findById(chatId);
        if(!chatAvailable) {
            return res.status(500).json({message:"Chat not found"});
        }
        const promises = messagesIds.map(async(messageId) => {
            const message = await Message.findById(messageId);
            if(message && !message.deletedBy.includes(userId)) {
                message.deletedBy.push(userId);
                await message.save();
            }
        });

        await Promise.all(promises);
        let chats = await Chat.findById(chatId).populate('createdBy','username')
        .populate({path:'participants.user',select:'username'})
        .populate({
            path:'messages',
            populate:{path:'sender',select:'username email'}
        }).exec();

        res.status(200).json(chats)
    } catch (error) {
        console.error(error);
        res.status(500).json({message:"Something went wrong"})
    }
});

app.post("/router/deleteForEveryone",userAuth,async(req,res) => {
    let {messagesIds, chatId} = req.body;
    // console.log(messagesIds,chatId)
    const userId = req.user.username; // user id
    // console.log(userId)
    try {
        const promises = messagesIds.map(async(messageId) => {
            const message = await Message.findById(messageId);
            if(message && message.sender.toString() === userId.toString()) {
                message.deleted = true;
                message.content = "This message was deleted";
                await message.save();
            }
        });

        await Promise.all(promises);
        let chats = await Chat.findById(chatId).populate('createdBy','username')
        // .populate('participants','username')
        .populate({path:'participants.user',select:'username'})
        .populate({
            path:'messages',
            populate:{path:'sender',select:'username email'}
        }).exec();

        res.status(200).json(chats)
    } catch (error) {
        console.error(error);
        res.status(500).send
    }
});

app.post('/router/addUserInGroupDetails',userAuth,async(req,res) => {
    console.log(req.body.chatId);
    let chatData = await Chat.findById(req.body.chatId);
    const allUsers = await User.find({},'_id username email');
    const idsInChatData = new Set(chatData.participants.map(participant => participant.user.toString()));
    const userNotInData = allUsers.filter(user => !idsInChatData.has(user._id.toString()));

    res.status(200).json({message:'done',chatData,userNotInData})
});

let onlineUsers = [];
let userChatMap = {};


io.on('connection',(socket) => {    
    console.log("listen to a connection addNewUser",socket.id)
    socket.on("addNewUser",async(userId) => {
        // console.log("I am triggered")
        // console.log(userId,"userId 304")
        await OnlineUser.findOneAndUpdate(
            {userId},
            {socketId:socket.id,lastActive:new Date()},
            {upsert:true,new:true}
        );

        onlineUsers = await OnlineUser.find({});
        io.emit("getOnlineUsers",onlineUsers);

    });

    socket.on('sendMessage', async ({chatId, content, senderId}) => {
        try {
            let chatAvailable = await Chat.findById(chatId);
            if(!chatAvailable) {
                console.error('Chat with id not found');
                return;
            }     
            const messageData = new Message({chat:chatId,content,sender:senderId, readBy:[{user:senderId,readAt:new Date()}]});
            await messageData.save();
            //update
            await Chat.findByIdAndUpdate(
                chatId,{$push:{messages:messageData._id},
                        lastMessage:messageData._id,

                },
                {new:true}
            );

        const participantsIds = chatAvailable.participants.map((participant) => participant.user.toString());//.toString();
        // console.log(participantsIds,'-----539');

        for(const participantId of participantsIds) {
            if(userChatMap[participantId] === chatId) {
                const alreadyRead = messageData.readBy.some((read) => read.user.toString() === participantId);
                if(!alreadyRead) {
                    messageData.readBy.push({user:participantId,readAt:new Date()});
                }
            }
        }
        await messageData.save()

        const updatedChat = await Chat.findById(chatId)
        .populate('createdBy','username')
        .populate({path:'participants.user',select:'username email'})
        .populate({
            path:'messages',
            populate:{path:'sender',select:'username email'}
        })
        .exec(); 
        const updateMessagesReadStatus = async () => {
            for(const message of updatedChat.messages) {
                const allReadByUsers = message.readBy.map((rb) => rb.user.toString());
                // console.log(allReadByUsers,'--------609')
                const allRead = participantsIds.every((id) => allReadByUsers.includes(id));
                // console.log(allRead,'--------610');
                if(allRead && !message.allUserRead) {
                    message.allUserRead = true;
                    await message.save();
                }
            }
        };

        await updateMessagesReadStatus();

            const userIDs = await Chat.findById(chatId).populate('participants.user','_id');
            // for(const participant of userIDs.participants) {
                userIDs.participants.forEach(async(participant) => {
                    const userId = participant.user._id.toString();
                    const onlineUser = onlineUsers.find(user => user.userId.toString() === userId);
                    if(onlineUser) {
                        io.to(onlineUser.socketId).emit('newMessage',updatedChat);
                        //chatList
                        io.to(onlineUser.socketId).emit('updateChatList',updatedChat);
                    }
                })

        } catch (error) {
            console.error(error)
        }
    });

        // // socket.emit('markAsRead',{userId:parseData.user.id,chatId:id});
        socket.on('markAsRead',async({chatId, userId}) => {
            let chatAvailable = await Chat.findById(chatId);
            if(!chatAvailable) {
                console.error('Chat with id not found');
                return;
            }  
            const chat = await Chat.findById(chatId)
                .populate('createdBy','username')
                .populate({path:'participants.user',select:'username'})
                // .populate('participants','username')
                .populate({
                    path:'messages',
                    populate:{path:'sender',select:'username email'}
                }).exec();
    
            // console.log(chat,"---711--")
            const promises1 = chat.messages.map(async (getReadBy) => {
                const readByUserIds = (getReadBy.readBy.map(participant => participant.user));
                const exist = readByUserIds.some(id => id.equals(userId));
                if(!exist) {
                    getReadBy.readBy.push({user:userId,readAt:new Date()})
                    await getReadBy.save()
                }
            })
            await Promise.all(promises1);
            const participantsIds = (chat.participants.map(participant => participant.user._id));
            const promises = chat.messages.map(async (wholeMessages) => {
                let getAllReadByUser = wholeMessages.readBy.map(existAllUser => existAllUser.user);
                // console.log(getAllReadByUser,"---782--")
                let allPresent = participantsIds.every(participant => getAllReadByUser.some(getAllReadByUserParticipant => participant.toString() === getAllReadByUserParticipant.toString()));
                if(allPresent) {
                    // console.log(wholeMessages.allUserRead,'--------590--');
                    wholeMessages.allUserRead = true;
                    await wholeMessages.save();
                }
            })
            await Promise.all(promises);
    
            // console.log(chat,"----------637-----------");
            const userIDs = await Chat.findById(chatId).populate('participants.user','_id');
            userIDs.participants.forEach(async(participant) => {
                const userId = participant.user._id.toString();
                const onlineUser = onlineUsers.find(user => user.userId.toString() === userId);
                if(onlineUser) {
                    // socket.broadcast.to(onlineUser.socketId).emit('markAsReadByReceiver',wholeChat);
                    socket.broadcast.to(onlineUser.socketId).emit('markAsReadByReceiver',chat);
                    io.to(onlineUser.socketId).emit('updateChatList',chat);

                }
            })
        });

    // socket.emit('activeChatId',{userId:parseData.user.id,chatId:id});
    // socket.emit('activeChatId',{userId:parseData.user.id,chatId:id});
    socket.on('activeChatId',({usersId,chatsId}) => {
        console.log(usersId,chatsId)
        userChatMap[usersId] = chatsId;
        console.log(userChatMap);
    });

    // socket.emit('activeChatIdClose',{usersId:parseData.user.id,chatsId:id});
    // socket.emit('activeChatIdClose',{usersId:parseData.user.id,chatsId:id});
    socket.on('activeChatIdClose',({usersId,chatsId}) => {
        delete userChatMap[`${usersId}`];
    });

    // socket.emit('deleteMessage',{chatId:id,messagesIds:selectedMessages,senderId:parseData.user.id});
    socket.on('deleteMessage',async ({chatId, messagesIds, senderId}) => {
        let chatAvailable = await Chat.findById(chatId);
        if(!chatAvailable) {
            return;
        }
        try {
            const promises = messagesIds.map(async(messageId) => {
                const message = await Message.findById(messageId);
                if(message && message.sender.toString() === senderId.toString()) {
                    message.deleted = true;
                    message.content = "This message was deleted";
                    await message.save();
                }
            });
            await Promise.all(promises);
            let chats = await Chat.findById(chatId).populate('createdBy','username')
            .populate({path:'participants.user',select:'username'})
            .populate({
                path:'messages',
                populate:{path:'sender',select:'username email'}
            }).exec();

            const userIDs = await Chat.findById(chatId).populate('participants.user','_id');
            userIDs.participants.forEach(async(participant) => {
                const userId = participant.user._id.toString();
                const onlineUser = onlineUsers.find(user => user.userId.toString() === userId);
                if(onlineUser) {
                    io.to(onlineUser.socketId).emit('deleteNewMessage',chats);
                }
            })

        } catch (error) {
            console.error(error)
        }
    });

    // socket.emit('typing',{chatId:id,userId:parseData.user.id});
    socket.on('typing',async({chatId, userId1}) => {
        const userIDs = await Chat.findById(chatId).populate('participants.user','_id');
        if(userIDs == null) {
            return 
        }
        try {
            userIDs.participants.forEach(async(participant) => {
                const userId = participant.user._id.toString();
                const onlineUser = onlineUsers.find(user => user.userId.toString() === userId);
                if(onlineUser) {
                    socket.broadcast.to(onlineUser.socketId).emit('userTyping',{chatId,userId1});
                }
            })
        } catch (error) {
            console.log("Something went wrong")
        }
    })

    // socket.emit('stopTyping',{chatId:id,userId:parseData.user.id});
    socket.on('stopTyping',async({chatId, userId1}) => {
        const userIDs = await Chat.findById(chatId).populate('participants.user','_id');
        try {
            userIDs.participants.forEach(async(participant) => {
                const userId = participant.user._id.toString();
                const onlineUser = onlineUsers.find(user => user.userId.toString() === userId);
                if(onlineUser) {
                    socket.broadcast.to(onlineUser.socketId).emit('userStopTyping',{chatId,userId1});
                }
            })
        } catch (error) {
            return console.log("Something went wrong")
        }
    });

    // socket.emit('addNewUserInGroup',{chatId:id,newUserIds:selectedMembers});
    socket.on('addNewUserInGroup',async ({chatId,newUserIds,userId}) => {
        if(!chatId && !Array.isArray(newUserIds) || newUserIds.length === 0) {
            return;
        }
        const chat = await Chat.findById(chatId)
        .populate('createdBy','username')
        .populate({path:'participants.user',select:'username'})
        .populate({
        path:'messages',
        populate:{path:'sender',select:'username email'}
        }).exec();
        if(!chat) {
            return;
        } 
        newUserIds.forEach(async(userId) => {
            chat.participants.push({user:userId,joinedAt:Date.now()})
        })
        await chat.save();
        const chat2 = await Chat.findById(chatId)
        .populate('createdBy','username')
        .populate({path:'participants.user',select:'username'})
        .populate({
        path:'messages',
        populate:{path:'sender',select:'username email'}
        }).exec();
        let abc = await Chat.findById(chatId)
                    .populate({path:'participants.user',select:'username email'})
                    .populate({
                        path:'messages',
                        populate:{path:'sender',select:'username email'}
                    });
    

        const userIDs = await Chat.findById(chatId).populate('participants.user','_id');
        userIDs.participants.forEach(async(participant) => {
            const userId = participant.user._id.toString();
            const onlineUser = onlineUsers.find(user => user.userId.toString() === userId);
            if(onlineUser) {
                io.to(onlineUser.socketId).emit('addNewUserInGroupFront',chat2);
                // console.log(chat,"chat 583")
            }
        })

        newUserIds.forEach(async(userId) => {
            let onlineUser2 = onlineUsers.find(user => user.userId.toString() === userId)
            if(onlineUser2) {
                // console.log(abc,'=======683')
                io.to(onlineUser2.socketId).emit('updateChatList',abc);
            }
        })

    });


    socket.on('disconnect',async() => {
        onlineUsers.map((a) => {
            if(a.socketId == socket.id) {
                delete userChatMap[`${a.userId.toString()}`];
            }
        })
        await OnlineUser.findOneAndDelete({socketId:socket.id})
        onlineUsers = onlineUsers.filter((user) => user.socketId !== socket.id);
        io.emit("getOnlineUsers",onlineUsers);
    });

})

server.listen(8080, () => {
    console.log("Port on listing on 8080")
});
