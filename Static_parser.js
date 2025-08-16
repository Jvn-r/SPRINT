//Will read static a opfile.txt convert into structured JSON and sends it over to client via websockets

const { timeStamp } = require("console");
const fs = require("fs");
const readline = require("readline");

const WebSocket = require("ws");
const wss = new WebSocket.Server({port : 8080});

wss.on("connection", ws =>{
    console.log("CLIENT CONNECTEDD")

    ws.send(JSON.stringify({ status: "connected", message: "Welcome to Process Visualizer+" })); 

    const filePath = "opfile.txt";
    const fileStream = fs.createReadStream(filePath,{
        encoding: "utf-8",
        flags: "r"
    });
    
    const rl = readline.createInterface({
        input:fileStream,
        crlfDelay:Infinity //this is just to make sure any \n's in the file are handled properly 
    });

    rl.on("line",(line)=>{
        const parsed = parseLine(line);
        if(parsed){
            console.log(JSON.stringify(parsed,null,2)); //printing parsed data for testing
            ws.send(JSON.stringify(parsed));
        }
    }); 
    
    fileStream.on("error", (err)=> {
        console.error("ERROR reading the file:",err);
    });
    
    ws.on("close", () => console.log("CLIENT CLOSED"));
    ws.on("error", err => console.log("EORROOR:",err));
});

function parseLine(line){
    const regex = /^(\d{2}:\d{2}:\d{2}\.\d+)\s+(\S+)\s+\((\d+)\.(\d+)\)\s+(\S+)\/(\S+)\s+'([^']+)'\s*(.*?)\s*->\s*(\S+)$/;
    //this is basically the suructure of the wtrace output, represented as integers(d) and Strings(S) so that we can break down the long staring of wtrace data into smaller bits and save them with their own names, done in return
    //Example wtrace output: 21:06:14.1822 System (4.6048) FileIO/Write 'C:\WINDOWS\system32\Logfiles\WMI\RtBackup\EtwRTwtrace-rt.etl' offset: 72, size: 65392 -> SUCCESS
    const match = line.match(regex);
    if(!match) return null;
    //the if statement is to ignore any line that doesnt follow our regex structure

    return {
        timestamp : match[1],
        processName : match[2],
        processId : match[3],
        threadId : match[4],
        category : match[5],
        operation : match[6],
        target : match[7],
        details : match[8],
        result : match[9]
    };
}
