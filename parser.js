// Will read opfile.txt, convert into structured JSON, and send it over WebSockets in REAL TIME

const fs = require("fs");
const WebSocket = require("ws");
const {Tail} = require("tail");

const wss = new WebSocket.Server({port: 8080});
console.log("WebSocket server: ws://localhost:8080");

//Tailing the file in real-time, to update and read new lines as they come in
const tail = new Tail("opfile.txt", { useWatchFile : true }); 

//When a new line is added, read and broadcast it to webpage
tail.on("line", (line) =>{
    const parsed = parseLine(line);
    if (parsed){
        console.log("New line parsed:", parsed);
        broadcast(parsed);
    }
});

tail.on("error", (err) =>{
    console.error("Tail error:", err);
});

wss.on("connection", (ws) =>{
    console.log("Client connected");
    
    ws.send(JSON.stringify({ 
        status: "connected", 
        message: "Welcome to Process Visualizer+" 
    }));

    ws.on("close", () => console.log("Client disconnected"));
    ws.on("error", (err) => console.log("WebSocket error:", err));
});

//Actual Boradcast function
function broadcast(data){
    const msg = JSON.stringify(data);
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(msg);
        }
    });
}

function parseLine(line) {
    const regex =
        /^(\d{2}:\d{2}:\d{2}\.\d+)\s+(\S+)\s+\((\d+)\.(\d+)\)\s+(\S+)\/(\S+)\s+'([^']+)'\s*(.*?)\s*->\s*(\S+)$/;

    const match = line.match(regex);
    if (!match) return null;

    return {
        timestamp: match[1],
        processName: match[2],
        processId: match[3],
        threadId: match[4],
        category: match[5],
        operation: match[6],
        target: match[7],
        details: match[8],
        result: match[9],
    };
}
