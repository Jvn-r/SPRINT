//Just a static Wtrace output parser, for testing purposes

const { timeStamp } = require("console");
const fs = require("fs");
const readline = require("readline");

const filePath = "opfile.txt";

const fileStream = fs.createReadStream(filePath,{
    encoding: "utf-8",
    flags: "r"
});

const rl = readline.createInterface({
    input:fileStream,
    crlfDelay:Infinity //this is just to make sure any \n's in the file are handled properly 
});

function parseLine(line){
    const regex = /^(\d{2}:\d{2}:\d{2}\.\d+)\s+(\S+)\s+\((\d+)\.(\d+)\)\s+(\S+)\/(\S+)\s+'([^']+)'\s*(.*?)\s*->\s*(\S+)$/;
    //this is basically the suructure of the wtrace output, represented as integers(d) and Strings(S) so that we can break down the long staring of wtrace data into smaller bits and save them with their own names, done in return

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

rl.on("line",(line)=>{
    const parsed = parseLine(line);
    if(parsed){
        console.log(JSON.stringify(parsed,null,2)); //printing parsed data for testing

    }
});

fileStream.on("error", (err)=> {
    consoq.error("ERROR reading the file:",err);
});