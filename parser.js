// Will read opfile.txt, convert into structured JSON, and send it over WebSockets in REAL TIME

const fs = require("fs");
const WebSocket = require("ws");
const { Tail } = require("tail");
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

const wss = new WebSocket.Server({ port: 8080 });
console.log("WebSocket server: ws://localhost:8080");

//const logFilter = new LogFilter();
//Example filters
//logFilter.addFilter((log) => log.operation == "OPEN");
//logFilter.addFilter((log) => log.processName == "SystemIdle"); 

//dynamic filters so we can just update the arrays and itll filter for those
let whitelist = []; //ex ["OPEN", "WRITE"]
let blacklist = []; //ex ["CLOSE"]

//category filters (FileIO / Registry / Network etc) coming from client
let categoryFilters = new Set(); // if empty => allow all categories

//simple stats counters
let stats = {
    totalEvents: 0,
    perCategory: new Map(), // category -> count
};

//to update stats
function bumpStats(event) {
    stats.totalEvents++;
    const cat = event.category || "UNKNOWN";
    stats.perCategory.set(cat, (stats.perCategory.get(cat) || 0) + 1);
}

//apply op-level filters (whitelist/blacklist) + category filter
function applyFilters(event) {
    //if whitelist exists, operation must be in it
    if (whitelist.length > 0 && !whitelist.includes(event.operation)) {
        return false;
    }
    //blacklist blocks operations
    if (blacklist.includes(event.operation)) {
        return false;
    }
    //category filters: if set non-empty, only allow those categories
    if (categoryFilters.size > 0 && !categoryFilters.has(event.category)) {
        return false;
    }
    return true;
}

//Tailing the file in real-time, to update and read new lines as they come in
const tail = new Tail("opfile.txt", { useWatchFile: true });

//When a new line is added into opfile.txt, read and broadcast it to webpage
tail.on("line", (line) => {
    try {
        const parsed = parseLine(line);
        //only proceed when parse succeded and our filters allow it
        if (parsed && applyFilters(parsed)) {
            //Group by processName
            if (!processBuckets.has(parsed.processName)) {
                processBuckets.set(parsed.processName, []);
            }
            processBuckets.get(parsed.processName).push(parsed);

            //update local stats
            bumpStats(parsed);

            //broadcast single event too
            broadcast(parsed);
        }
    } catch (err) {
        console.error("Error handling tail line:", err);
    }
});

tail.on("error", (err) => {
    console.error("Tail error:", err);
});

//connecting to the localhost webpage, will work after the html file is run
wss.on("connection", (ws) => {
    console.log("Client connected");

    ws.send(JSON.stringify({
        status: "connected",
        message: "Welcome to Process Visualizer+"
    }));

    //ro receive messages from client, like filters or commands
    ws.on("message", (msg) => {
        try {
            const data = JSON.parse(msg);

            //dynamic filter updates from webpage
            if (data.type === "filters") {
                //accept categories array OR whitelist/blacklist arrays
                if (Array.isArray(data.categories)) {
                    categoryFilters = new Set(data.categories);
                    console.log("Updated category filters:", [...categoryFilters]);
                }
                if (Array.isArray(data.whitelist)) {
                    whitelist = data.whitelist;
                    console.log("Updated operation whitelist:", whitelist);
                }
                if (Array.isArray(data.blacklist)) {
                    blacklist = data.blacklist;
                    console.log("Updated operation blacklist:", blacklist);
                }

                //ACK back current filter state
                ws.send(JSON.stringify({
                    type: "filtersAck",
                    categories: [...categoryFilters],
                    whitelist,
                    blacklist
                }));
            }

            //simple control commands (optional future use)
            if (data.type === "command") {
                if (data.cmd === "clearBuckets") {
                    processBuckets.clear();
                    ws.send(JSON.stringify({ type: "commandAck", cmd: "clearBuckets" }));
                }
            }

            //answering client stats request
            if (data.type === "statsRequest") {
                ws.send(JSON.stringify({
                    type: "stats",
                    events: stats.totalEvents,
                    perCategory: Object.fromEntries(stats.perCategory)
                }));
            }
        } catch (err) {
            //ignoring any non-json or bad messages
            console.warn("Bad WS message:", msg);
        }
    });

    ws.on("close", () => console.log("Client disconnected"));
    ws.on("error", (err) => console.log("WebSocket error:", err));
});

//actual Boradcast function, to send data into the website
function broadcast(data) {
    try {
        const msg = JSON.stringify(data);
        wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(msg);
            }
        });
    } catch (err) {
        console.error("Broadcast error:", err);
    }
}

//parse individual line into a structured JSON
function parseLine(line) {
    const regex =
        /^(\d{2}:\d{2}:\d{2}\.\d+)\s+(\S+)\s+\((\d+)\.(\d+)\)\s+(\S+)\/(\S+)\s+'([^']+)'\s*(.*?)\s*->\s*(\S+)$/;

    const match = line.match(regex);
    if (!match) return null;

    //this is to shorten long target paths
    let target = match[7];
    let targetShort = target;
    if (target.length > 40) {
        targetShort = target.slice(0, 37) + "...";
    }

    //createing event object first
    const event = {
        timestamp: match[1],
        processName: match[2],
        processId: match[3],
        threadId: match[4],
        category: match[5],
        operation: match[6],
        target,
        targetShort,
        details: match[8],
        result: match[9],
        severity: "info"
    };

    //adding severity visualization thru colors, previously declared
    for (let key in severityMap) {
        //checking operation to make sure correct colores
        if ((event.operation && event.operation.includes(key)) ||
            (event.result && event.result.includes(key))) {
            event.severity = severityMap[key];
            break;
        }
    }
    return event;
}

//adding a 5 second flush to do aggregation of data,i.e instead of sending every single event we bundle some of em together and send in batches every 5 seconds
setInterval(() => {
    //only flush when someone is listening
    if (wss.clients.size === 0) return;

    for (let [proc, events] of processBuckets.entries()) {
        if (events.length > 0) {
            //sending an aggregated value, i.e bundling a bunch or events and sending em together
            broadcast({
                type: "ProcessBatch",
                processName: proc,
                count: events.length,
                events
            });
            //reset bucket
            processBuckets.set(proc, []);
        }
    }
}, 5000);

//broadcasting stats to webpage every 2000ms 
setInterval(() => {
    if (wss.clients.size === 0) return;
    const shortPerCat = Object.fromEntries(stats.perCategory);
    broadcast({
        type: "stats",
        events: stats.totalEvents,
        perCategory: shortPerCat
    });
}, 2000);
