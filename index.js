const express = require('express');
const app = express();
const PORT = 4000;

const http = require('http').Server(app);
const cors = require('cors');
app.use(cors());
const socketIO = require('socket.io')(http, {
  cors: {
      origin: "http://localhost:3000"
  }
});

let users = [];
let arr = []
//Add this before the app.get() block
socketIO.on('connection', (socket) => {
  console.log(`: ${socket.id} user just connected!`);
 
  socket.on('userId', (userId) => {
    console.log(`User ${userId} connected`);
    let ids =  arr.map((a) => a.userId)

    arr.push({id: socket.id, userId: userId})
    socketIO.emit('newUserResponse', arr);
    // if (ids.includes(userId)) {

    // } else {
    //   arr.push({id: socket.id, userId: userId})
    //   socketIO.emit('newUserResponse', arr);
    // }
   
  });

   //sends the message to all the users on the server
  socket.on('message', (data) => {
    socketIO.emit('messageResponse', data);
  });

  //sends the message to specific user on the server
  socket.on('sendNotification', (data) => {
    let xx = arr.find((a)=> a.userId === data.recipientId)
    const {  message } = data;
    socketIO.to(xx.id).emit('receiveNotification', message);
  });

  socket.on('sendConferenceNotification', (data) => {
    for (let i=0; i<arr.length; i++) {
      const { message } = data;
      socketIO.to(arr[i].id).emit('receiveNotification', message);
    }
  });

  socket.on('newUser', (data) => {
    users.push(data);
    //Sends the list of users to the client
    socketIO.emit('newUserResponse', users);

    //Adds the new user to the list of users
    // let ids  = users.map((a) => a.socketID)
    // if (ids.includes(data.socketID)) {
    //   socketIO.emit('newUserResponse', users);
    // } else {
    //   users.push(data);
    //   //Sends the list of users to the client
    //   socketIO.emit('newUserResponse', users);
    // }
    
  });

  
  socket.on('disconnect', () => {
    console.log(': A user disconnected');
    //Updates the list of users when a user disconnects from the server
    arr = arr.filter((user) => user.id !== socket.id)
    // console.log(users);
    //Sends the list of users to the client
    socketIO.emit('userLogoutResponse', arr);
 
    socket.disconnect();
  });


});



app.get('/api', (req, res) => {
  res.json({
    message: 'Hello world',
  });
});

http.listen(PORT, () => {
  console.log(`Server listening on ${PORT}`);
});