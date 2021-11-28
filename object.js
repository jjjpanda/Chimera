const cocoSsd = require('@tensorflow-models/coco-ssd');
const tf = require('@tensorflow/tfjs-node');
const path = require('path')

console.log("LOADING MODEL")
const model = cocoSsd.load()

const pathToImg = path.join(__dirname, './feed/1/output.jpg')
console.log("MODEL LOADED, STARTING LOOP")

while(true){
    fs.readFile(pathToImg, (err, data) => {
        if(!err){
            const imgTensor = tf.node.decodeImage(new Uint8Array(data), 3);
            const results = model.detect(imgTensor);
            console.log(results)
        }
        else{
            console.log("ERROR IN READING FILE", err)
        }
    })
}