console.log("The main thread has started");

let num_cores = 0; 

const N = 1000; //matrix size
let NUM_WORKERS; //the number of workers used

//declare the matrices
let mat1;
let mat2; 

const runs = 50; 
const timings = [];
const timings_without_init = [];

//array to store results for csv
const experimentResults = [];

//i want the number of cores to be updated based on the user's device
//the update will be done manually for the time being
document.getElementById("text-cores").addEventListener("change", updateCores);

function updateCores() {
    var cores = document.getElementById("text-cores");

    if (!cores.value.trim()){
        console.warn("Empty input. Expecting number of cores");
        return; 
    }

    num_cores = parseInt(cores.value, 10);
    console.log("User's cores are: ", num_cores);
    console.log(typeof(num_cores));

    //the rest of the code after the number of cores is a valid number
    console.log("Running the rest of the code");

    NUM_WORKERS = num_cores;

    runExperiment();
}

//function to download the csv file
const download = (data) => {
    //Create a Blob with the csv data and type
    const blob = new Blob([data], {type: 'text/csv'});

    //create a url for the blob
    const url = URL.createObjectURL(blob);

    //create an anchor tag for downloading
    const a = document.createElement('a');

    //set the url and the download attribute of the anchor tag
    a.href = url; 
    a.download = 'download.csv';

    //trigger the download by clicking the anchor tag
    a.click();
}

//function to create a csv string from an object
const csvmaker = () => {
    // //get the keys (headers) of the object
    // const headers = Object.keys(data);

    // //get the values of the object
    // const values = Object.values(data);

    // //Join the headers and values with commas and newlines
    // return [headers.join(','), values.join(',')].join('\n');
    let csvContent = "Matrix Size, Method, Run, Execution Time, Execution time without init, Average worker init time";

    experimentResults.forEach(result => {
        csvContent += `${result.matrix_size}, ${result.method}, ${result.run}, ${result.time}, ${result.time_without}, ${result.average_init}\n`;

    });

    return csvContent;
}

// //asynchronous function to fetch data and download the csv file
const get = async() => {
    // const data = {
    //     matrix_size: N, 
    //     method: "Workers",
    //     run_num: run_num,
    //     average_worker_init_time_for_run: avg_worker_init,
    //     overall_execution_time: ex_time,
    //     execution_time_without_init: ex_time_without_init
    // };

    //Create the csv string from the data
    const csvdata = csvmaker();

    //download the csv file
    download(csvdata);
}

//generate random N x N matrix
function generateMatrix(N){
    let matrix = new Array(N);
    for(let i = 0; i < N; i++){
        matrix[i] = new Array(N);
        for(let j = 0; j < N; j++){
            matrix[i][j] = Math.floor(Math.random() * 10);
        }
    }
    return matrix; 
}

async function runExperiment(){
    //prepare the final results matrix
    //MAYBE MOVE TO RUNWORKER FUNCTION
    let res = new Array(N);
    for(let i = 0; i < N; i++){
        res[i] = new Array(N);
    }

    let t = 0; 
    //test the code in a for loop
    for(t; t < runs; t++){
        //console.log("Currently in for loop to run experiments");
        mat1 = generateMatrix(N);
        mat2 = generateMatrix(N);
        
        //object to get the ex_time and ex_without_init time from promise
        const {ex_time, ex_time_without_init} = await runWorker(mat1, mat2, N, res, t);
        console.log(`Run ${t+1}: Execution time with Web Workers: ${ex_time.toFixed(2)} ms`);
        console.log(`Run ${t+1}: Execution time with Web Workers without initialization time: ${ex_time_without_init.toFixed(2)} ms`);
        timings.push(ex_time);
        timings_without_init.push(ex_time_without_init);
    }

    console.log(`The experiment runs have ended and they were in total: ${t} `);

    plotTimings();

    get();
}

function runWorker(mat1, mat2, N, res, t){
    //declare the variables used in performance
    let start; 
    let end; 
    let ex_time; 
    let ex_time_without_init;
    //console.log("In function runWorker out of new Promise");
    return new Promise((resolve) =>{
        let finishedWorkers = 0;
        let avg_worker_init;
        start = performance.now();

        //create array to save the average times
        const w_init_times = [];

        for(let w = 0; w < NUM_WORKERS; w++){
            //measure worker initalization time, that's including the splitting of the matrices and the transfer of messages
            const w_start = performance.now();
            
            const worker = new Worker('worker.js');

            //split the rows among workers
            let rowStart = Math.floor(w * N / NUM_WORKERS);
            let rowEnd = Math.floor((w + 1) * N / NUM_WORKERS);

            worker.postMessage({ mat1, mat2, N, rowStart, rowEnd });

            worker.onmessage = function(event){
                //print the initialization time
                const initTime = performance.now() - w_start;
                w_init_times.push(initTime);
                console.log(`Time taken to initialize worker: ${initTime}`);

                let { partialRes, rowStart } = event.data; 

                //copy partial result back into main result matrix
                for(let i = 0; i < partialRes.length; i++){
                    res[rowStart + i] = partialRes[i];
                }

                finishedWorkers++;

                //when all web workers finish
                if(finishedWorkers === NUM_WORKERS){
                    //overall execution
                    end = performance.now();
                    ex_time = end - start; 
                    let sum_w_init_times = 0;

                    //add an execution time without worker initialization
                    //THIS ONE DOES NOT WORK CORRECTLY
                    // let sum_w_init_times = w_init_times.reduce(function (x, y){
                    //     return x + y;
                    // }, 0);

                    for(let i = 0; i < w_init_times.length; i++){
                        sum_w_init_times = sum_w_init_times + w_init_times[i];
                    }
                    // console.log(sum_w_init_times);

                    //print the average initilization time for each run
                    avg_worker_init = sum_w_init_times / w_init_times.length;
                    console.log(`The average initialization: ${avg_worker_init.toFixed(2)} ms`);

                    /* in order to find the execution time without the workers' overhead the average initialization time is subtracted
                    since all of the workers execute in parallel and by subtracting the sum of initialization times doesn't provide an 
                    accurate representation (also the ex_time_without_init is negative)*/
                    ex_time_without_init = end - start - avg_worker_init;
                    //return an object because js cannot deconstruct without this
                    resolve({ex_time, ex_time_without_init});
                    
                    
                    experimentResults.push({
                        matrix_size: N, 
                        method: `Workers ${NUM_WORKERS}`,
                        run: t, 
                        time: ex_time,
                        time_without: ex_time_without_init,
                        average_init: avg_worker_init
                    });


                }
            }

            worker.onerror = (event) => {
                console.log("An error occured with this worker");
            }
        };

    });

    
    
}

function plotTimings(){
    const canvas = document.getElementById('chart');
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const generalPadding = 50; 
    const leftPadding = 80
    const width = canvas.width - leftPadding - generalPadding * 2; 
    const height = canvas.height - generalPadding * 2; 

    //Plot the timings
    const maxTime = Math.max(...timings);
    const minTime = Math.min(...timings);
    const scaleY = height / (maxTime - minTime);
    const scaleX = width / (timings.length - 1);

    //Draw axes
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(leftPadding, generalPadding);
    ctx.lineTo(leftPadding, canvas.height - generalPadding);
    ctx.lineTo(canvas.width - generalPadding, canvas.height - generalPadding);
    ctx.stroke();

    //Y-axis labels and ticks
    ctx.filelStyle = 'black';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    const steps = 5;
    for(let i = 0; i <= steps; i++){
        const val = minTime + (i * (maxTime - minTime)) / steps;
        const y = canvas.height - generalPadding - (val - minTime) * scaleY; 
        ctx.fillText(val.toFixed(1) + ' ms', leftPadding - 10, y);
        ctx.beginPath();
        ctx.moveTo(leftPadding - 5, y);
        ctx.lineTo(leftPadding, y);
        ctx.stroke();
    }

    //X-axis labels
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const labelCount = Math.min(10, timings.length);
    for(let i = 0; i < labelCount; i++){
        const index = Math.floor((i / (labelCount - 1)) * (timings.length - 1));
        const x = leftPadding + index * scaleX; 
        ctx.fillText(index + 1, x, canvas.height - generalPadding + 5);
        ctx.beginPath();
        ctx.moveTo(x, canvas.height - generalPadding);
        ctx.lineTo(x, canvas.height - generalPadding + 5);
        ctx.stroke();
    }

    //Draw performance line
    ctx.beginPath();
    ctx.moveTo(leftPadding, canvas.height - generalPadding - (timings[0] - minTime) * scaleY);

    for(let k = 0; k <timings.length; k++){
        const x = leftPadding + k * scaleX;
        const y = canvas.height - generalPadding - (timings[k] - minTime) * scaleY;
        ctx.lineTo(x, y);
    }
    ctx.strokeStyle = 'green';
    ctx.setLineDash([]); //solid line
    ctx.stroke();

    //draw average line
    const avg = timings.reduce((a, b) => a + b, 0) / timings.length; 
    const avgY = canvas.height - generalPadding - (avg - minTime) * scaleY;
    ctx.beginPath();
    ctx.moveTo(leftPadding, avgY);
    ctx.lineTo(canvas.width - generalPadding, avgY);
    ctx.strokeStyle = 'red';
    ctx.setLineDash([5, 5]);
    ctx.stroke();

    //draw legend
    ctx.setLineDash([]);
    ctx.fillStyle = 'black';
    ctx.fillText("Legend: ", canvas.width - generalPadding - 75, generalPadding);

    ctx.strokeStyle = 'green';
    ctx.beginPath();
    ctx.moveTo(canvas.width - generalPadding - 80, generalPadding + 15);
    ctx.lineTo(canvas.width - generalPadding - 50, generalPadding + 15);
    ctx.stroke();
    ctx.fillText("Run time", canvas.width - generalPadding -  25, generalPadding + 15);

    ctx.strokeStyle = 'red';
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(canvas.width - generalPadding - 80, generalPadding + 35);
    ctx.lineTo(canvas.width - generalPadding - 50, generalPadding + 35);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillText("Avg time", canvas.width - generalPadding - 25, generalPadding + 35);

    console.log(`Average time: ${avg.toFixed(2)} ms`);
}




