/* 
    Let's program #1!
    Create a node.js tail/less alike.
                                        */

const fs = require('fs');
const os = require('os');
const readline = require('readline');
const process = require('process');
const argv = require('yargs')
                    .default('s',0) //start num @ bytes
                    .default('e',Infinity) //end @ num bytes
                    .default('l',5) //num lines to output
                    .default('m','hex') //default encoding utf8/hex
                    .describe('m', "File encoding 'hex' or 'utf8'")
                    .describe('s', "Start at NUM bytes")
                    .describe('e', "End at NUM bytes")
                    .describe('l', "Output NUM lines").argv

if(argv.m !== 'utf8' && argv.m !== 'hex'){
    process.exit(1)
}

const path = argv.p;
const nlines = argv.l;
const encoding = argv.m
const hex_line_length = 16;
const options = {flags:'r', encoding:encoding, autoClose:true, start:argv.s, end:argv.e, highWaterMark:64*1024};
const forward_history = [];
const back_history = [];

let finished_reading = false;
let filestream = fs.createReadStream(path,options);
let rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
    historySize: 100,
    prompt: '> '
});

let remaining_chunk = '';

function findStrOccurances(str, item){
    let count = 0;
    let index;
    while((index = str.indexOf(item)) !== -1){
        count++;
        str=str.slice(index+item.length);
    }
    return count;
}

function splitThisManyTimes(str, item, n){
    let count = 0;
    let index;
    let values = [];
    while((index = str.indexOf(item)) !== -1){
        count++;
        values.push(str.slice(0, index));
        str = str.slice(index+item.length);

        if(count===n){
            return {val: values, str:str};
        }
    }
}

function outPutLines(line_array){
    line_array.forEach((line)=>{
        if(line){
            console.log(line);
        }
    })
}

function splitHexStr(h_str){
    let rv = [];
    let end_idx = 2;
    let str_idx = 0;
    while(end_idx <= h_str.length){
        rv.push(h_str.slice(str_idx,end_idx));
        str_idx+=2;
        end_idx+=2;
    }
    return rv;
}

function outPutHex(h_str){
    let bytes = splitHexStr(h_str);
    for(let i = 0; i<bytes.length; i++){
        process.stdout.write(bytes[i]);
        if( !((i+1) % hex_line_length) ){
            process.stdout.write(os.EOL);
        }else{
            process.stdout.write(" ");
        }
    }
}

function displayOutput(chunk){
    if(encoding === 'hex'){
        outPutHex(chunk);
    }
    else if(encoding === 'utf8'){
        outPutLines(chunk);
    }
    rl.prompt();
}

function processAndDisplay(){
    let output;
    if(encoding === 'hex'){
        let hex_str_len = hex_line_length * nlines * 2; //total number of chars of hex to display
        if(remaining_chunk.length >= hex_str_len){
            output = remaining_chunk.slice(0, hex_str_len);
            remaining_chunk = remaining_chunk.slice(hex_str_len);
            if(!finished_reading){
                //a readStream 'data' event brought you here
                filestream.pause();
            }
        }
        else if(finished_reading){
            //no more data events and also only chunk length < hex_str_len, so output remainder
            //also, you got here from a readline 'line' event
            output = remaining_chunk;
            remaining_chunk = '';
        }
    }
    else if(encoding === 'utf8'){
        if(findStrOccurances(remaining_chunk, os.EOL) >= nlines){
            let results = splitThisManyTimes(remaining_chunk, os.EOL, nlines);
            forward_history.push(results['val']);
            displayOutput(results['val']);
            remaining_chunk = results['str'];
            if(!finished_reading){
                filestream.pause();  
            }
        }
        else if(finished_reading && remaining_chunk){
            output = [remaining_chunk];
            remaining_chunk='';
        }
    }
    if(output){
        forward_history.push(output);
        displayOutput(output);
    }
}

filestream.on('data', (chunk) => {
    remaining_chunk += chunk;
    processAndDisplay();
});

filestream.on('end', function(){
    finished_reading = true;
    processAndDisplay();
});

filestream.on('error', function(error){
    process.stderr.write(error);
    process.stderr.write(os.EOL);
    rl.close();
})

rl.on('line', (line) => {
    if(line === 'j'){
        if(!back_history.length){
            if(!finished_reading){
                filestream.resume();
            }
            else if(finished_reading && !remaining_chunk){
                //get here if no more data to display, so display prompt.
                rl.prompt();
            }
            else if(finished_reading){
                processAndDisplay();
            }
        }
        else{
            let output = back_history.pop()
            forward_history.push(output);
            displayOutput(output);
        }
    }
    else if(line ==='k'){
        if(forward_history.length > 1){
            back_history.push(forward_history.pop());
            displayOutput(forward_history[forward_history.length-1]);
        }
        else{
            rl.prompt();
        }
    }
    else if(line === 'c'){
        rl.close();
    }
    else{
        rl.prompt();
    }
});
