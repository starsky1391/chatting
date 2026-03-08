const io = require('socket.io')(3000, { cors: { origin: "*" } }); 
 
 io.on('connection', (socket) => { 
     console.log('用户连接:', socket.id); 
 
     socket.on('join_room', (roomID) => { 
         socket.join(roomID); 
     }); 
 
     // 【核心修复】使用 socket.to(roomID).emit 
     // 这保证了消息只会发给房间里的“另一个人”，发送者自己收不到 
     socket.on('webrtc_message', (data) => { 
         socket.to(data.roomID).emit('webrtc_message', { 
             sender: socket.id, 
             type: data.type, 
             content: data.content 
         }); 
     }); 
 });