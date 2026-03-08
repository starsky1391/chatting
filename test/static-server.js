const express = require('express');
const path = require('path');
const app = express();

// 静态文件服务
app.use(express.static(__dirname));

// 根路径重定向到webrtc_audio.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'webrtc_audio.html'));
});

// 启动服务器
const PORT = 8081;
app.listen(PORT, () => {
    console.log(`静态文件服务器已启动，访问 http://localhost:${PORT} 查看WebRTC音频采集实验`);
});