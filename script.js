console.log("The main thread has started");

let num_cores = 0; 

const N = 1000; //matrix size
let NUM_WORKERS; //the number of workers used

//declare the matrices
let mat1;
let mat2; 

//declare the variables used in performance
let start; 
let end; 
let ex_time; 
let ex_time_without_init;

const runs = 20; 
const timings = [];
const timings_without_init = [];

//i want the number of cores to be updated based on the user's device
//the update will be done manually for the time being
document.getElementById("text-cores").addEventListener("change", updateCores);

function updateCores() {
    var cores = document.getElementById("text-cores");

    if (cores.value === " "){
        console.warn("Empty input. Expecting number of cores");
    }

    num_cores = parseInt(cores.value, 10);
    console.log("User cores are: ", num_cores);
    console.log(typeof(num_cores));

    //the rest of the code after the number of cores is a valid number
    console.log("Running the rest of the code");

    NUM_WORKERS = num_cores;

    runExperiment();
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
        const {ex_time, ex_time_without_init} = await runWorker(mat1, mat2, N, res);
        console.log(`Run ${t+1}: Execution time with Web Workers: ${ex_time.toFixed(2)} ms`);
        console.log(`Run ${t+1}: Execution time with Web Workers without initialization time: ${ex_time_without_init.toFixed(2)} ms`);
        timings.push(ex_time);
        timings_without_init.push(ex_time_without_init);
    }

    console.log(`The experiment runs have ended and they were in total: ${t} `);

    plotTimings();
}

function runWorker(mat1, mat2, N, res){
    //console.log("In function runWorker out of new Promise");
    return new Promise((resolve) =>{
        let finishedWorkers = 0;
        start = performance.now();

        for(let w = 0; w < NUM_WORKERS; w++){
            //create array to save the average times
            const w_init_times = [];
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
                    end = performance.now()
                    ex_time = end - start; 

                    //add an execution time without worker initialization
                    let sum_w_init_times = w_init_times.reduce(function (x, y){
                        return x + y;
                    }, 0);

                    ex_time_without_init = end - start - sum_w_init_times;
                    //return an object because js cannot deconstruct without this
                    resolve({ex_time, ex_time_without_init});
                    

                    //print the average initilization time for each run
                    avg_worker_init = w_init_times.reduce((a, b) => a + b, 0) / w_init_times.length;
                    console.log(`The average initialization: ${avg_worker_init.toFixed(2)} ms`);
                }
            }
        };
    });
    
}

function plotTimings(){
    const canvas = document.getElementById('chart');
    const ctx = canvas.getContext('2d');

    //Plot the timings
    const maxTime = Math.max(...timings);
    const scaleY = canvas.height / maxTime; 
    const scaleX = canvas.width / runs;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.beginPath();
    ctx.moveTo(0, canvas.height - timings[0] * scaleY);

    for(let i = 0; i < timings.length; i++){
        ctx.lineTo(i * scaleX, canvas.height - timings[i] * scaleY);
    }

    ctx.strokeStyle = 'purple';
    ctx.setLineDash([]); //solid line
    ctx.stroke();
    
    //Plot the timings_without_init to compare
    ctx.beginPath();
    ctx.moveTo(0, canvas.height - timings_without_init[0] * scaleY);
    
    for(let i = 0; i < timings_without_init.length; i++){
        ctx.lineTo(i * scaleX, canvas.height - timings_without_init[i] * scaleY);
    }

    ctx.strokeStyle = 'green';
    ctx.setLineDash([]); 
    ctx.stroke();

    //calculate averages with and without initialization time taken into account
    const avg = timings.reduce((a, b) => a + b, 0) / timings.length;
    const avg_without = timings_without_init.reduce((a, b) => a + b, 0) / timings_without_init.length;

    ctx.beginPath();
    ctx.moveTo(0, canvas.height - avg * scaleY);
    ctx.lineTo(canvas.width, canvas.height - avg * scaleY);
    ctx.strokeStyle = 'red';
    ctx.setLineDash([5, 5]);
    ctx.stroke();

    console.log(`Average time: ${avg.toFixed(2)} ms with ${NUM_WORKERS}`);
    console.log(`Average time without initialization: ${avg_without.toFixed(2)} ms with ${NUM_WORKERS}`);
}




