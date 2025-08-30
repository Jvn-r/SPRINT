// Will read opfile.txt, convert into structured JSON, and send it over WebSockets in REAL TIME

const fs = require("fs");
const WebSocket = require("ws");
const {Tail} = require("tail");
const LogFilter = require("./filters");
const { log } = require("console");

//aggregation feature req
const processBuckets = new Map();

//adding different colors to various operations
const severityMap = {
    "ERROR": "high",
    "ACCESS DENIED": "high",
    "SUCCESS": "low",
    "READ": "medium",
    "WRITE": "medium"
};

const wss = new WebSocket.Server({port: 8080});
console.log("WebSocket server: ws://localhost:8080");

//const logFilter = new LogFilter();
// Example filters
//logFilter.addFilter((log) => log.operation == "OPEN");
//logFilter.addFilter((log) => log.processName == "SystemIdle"); 

//dynamic filters so we can just update the arrays and itll filter for those
let whitelist = []; //ex ["OPEN", "WRITE"]
let blacklist = []; //ex ["CLOSE"]

function applyFilters(event) {
    if (whitelist.length > 0 && !whitelist.includes(event.operation)) {
        return false;
    }
    if (blacklist.includes(event.operation)) {
        return false;
    }
    return true;
}

//Tailing the file in real-time, to update and read new lines as they come in
const tail = new Tail("opfile.txt", { useWatchFile : true }); 

//When a new line is added into opfile.txt, read and broadcast it to webpage
tail.on("line", (line) =>{
    const parsed = parseLine(line);
    if (parsed && applyFilters(parsed)) {
    // Group by processName
        if (!processBuckets.has(parsed.processName)) {
            processBuckets.set(parsed.processName, []);
        }
    processBuckets.get(parsed.processName).push(parsed);
    }
    broadcast(parsed)
});

tail.on("error", (err) =>{
    console.error("Tail error:", err);
});

//connecting to the localhost webpage, will work after the html file is run
wss.on("connection", (ws) =>{
    console.log("Client connected");
    
    ws.send(JSON.stringify({ 
        status: "connected", 
        message: "Welcome to Process Visualizer+" 
    }));
    
    ws.on("close", () => console.log("Client disconnected"));
    ws.on("error", (err) => console.log("WebSocket error:", err));
});

//Actual Boradcast function, to send data into the website
function broadcast(data){
    const msg = JSON.stringify(data);
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(msg);
        }
    });
}

//Parse individual line into a structured JSON
function parseLine(line) {
    const regex =
        /^(\d{2}:\d{2}:\d{2}\.\d+)\s+(\S+)\s+\((\d+)\.(\d+)\)\s+(\S+)\/(\S+)\s+'([^']+)'\s*(.*?)\s*->\s*(\S+)$/;
        
    const match = line.match(regex);
    if (!match) return null;

    //this is to shorten any long file paths
    let targetShort = match[7];
    if (targetShort.length > 40){
        targetShort = targetShort.slice(0,37) + "...";
    }
    
    //ading severity visualization thru colors, previously declared
    let severity = "info";
    for (let key in severityMap) {
        if (line.includes(key)) {
            severity = severityMap[key];
            break;
        }
    }

    return {
        timestamp: match[1],
        processName: match[2],
        processId: match[3],
        threadId: match[4],
        category: match[5],
        operation: match[6],
        target: targetShort,
        details: match[8],
        result: match[9],
        severity
    };
}

//adding a 5 second flush to do aggregation of data,i.e instead of sending every single event we bundle some of em together and send in batches every 5 seconds
setInterval(() => {
    for (let [proc, events] of processBuckets.entries()) {
        if (events.length > 0) {
            broadcast({
                type: "ProcessBatch",
                processName: proc,
                count: events.length,
                events
            });
            processBuckets.set(proc, []); // reset bucket
        }
    }
}, 5000);
