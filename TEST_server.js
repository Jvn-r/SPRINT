//simple websockets TEST
const Websocket = require('ws');

const wss = new Websocket.Server({ port : 8080 });

wss.on('connection', (ws) => {
    console.log("Client Connected");
    const interval = setInterval(()=>{
        const randomValue = Math.random();
        ws.send(JSON.stringify({value:randomValue}));
        console.log("Sent DATA:",randomValue);
    },2000);

    ws.on('close', ()=> {
        clearInterval(interval);
        console.log("Connection closed");
    });
});

