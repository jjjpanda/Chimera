const cocoSsd = require('@tensorflow-models/coco-ssd');
const tf = require('@tensorflow/tfjs-node');
const path = require('path')
const fs = require('fs')

const pathToImg = path.join(__dirname, '../feed/1/output.jpg')

console.log("LOADING MODEL")
const model = cocoSsd.load().then(model => {
    console.log("MODEL LOADED, STARTING LOOP")
    fs.watch(pathToImg, (current, previous) => {
        fs.readFile(pathToImg, (err, data) => {
            if(!err){
                try{
                    const imgTensor = tf.node.decodeImage(new Uint8Array(data), 3);
                    model.detect(imgTensor).then(results => {
                        for(const result of results){
                            if(result.score > 0.5){
                                console.log(`OBJECT: ${result.class} | CONF: ${Math.round(result.score * 100)/100}`)
                            }
                        }
                    });
                }
                catch(e){
                    console.log("ERROR CAUGHT ", e)
                }
            }
            else{
                console.log("ERROR IN READING FILE", err)
            }
        })
    })
})