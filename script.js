console.log("The main thread has started");

const N = 500; //matrix size
const NUM_WORKERS = 8; //the number of workers used

//declare the matrices
let mat1; 
let mat2; 

//declare the variables used in performance
let start; 
let end; 
let ex_time; 

const runs = 50; 
const timings = [];

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
        
        ex_time = await runWorker(mat1, mat2, N, res);
        console.log(`Run ${t+1}: Execution time with Web Workers: ${ex_time.toFixed(2)} ms`);
        timings.push(ex_time);
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
            const worker = new Worker('worker.js');

            //split the rows among workers
            let rowStart = Math.floor(w * N / NUM_WORKERS);
            let rowEnd = Math.floor((w + 1) * N / NUM_WORKERS);

            worker.postMessage({ mat1, mat2, N, rowStart, rowEnd });

            worker.onmessage = function(event){
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
                    resolve(ex_time);
                }
            }
        };
    });
    
}

function plotTimings(){
    //Plot the timings
    const canvas = document.getElementById('chart');
    const ctx = canvas.getContext('2d');

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

    //draw average line
    const avg = timings.reduce((a, b) => a + b, 0) / timings.length;
    ctx.beginPath();
    ctx.moveTo(0, canvas.height - avg * scaleY);
    ctx.lineTo(canvas.width, canvas.height - avg * scaleY);
    ctx.strokeStyle = 'red';
    ctx.setLineDash([5, 5]);
    ctx.stroke();

    console.log(`Average time: ${avg.toFixed(2)} ms`);
}

runExperiment();


