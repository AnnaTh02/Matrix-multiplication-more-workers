//Worker thread
//console.log("Worker thread started");

onmessage = function(event){
    const start = this.performance.now()
    const { mat1, mat2, N, rowStart, rowEnd } = event.data;

    let partialRes = [];

    for(let i = rowStart; i < rowEnd; i++){
        let row = new Array(N);
        for(let j = 0; j < N; j++){
            row[j] = 0;
            for(let k = 0; k < N; k++){
                row[j] += mat1[i][k] * mat2[k][j];
            }
        }
        partialRes.push(row);
    }

    const exTime = performance.now() - start;
    postMessage({ partialRes, rowStart, exTime });
}