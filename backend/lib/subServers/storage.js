const express = require('express');

const app = express.Router();

app.post('/createVideo', validateBody, validateRequest, createVideo)
app.post('/listFramesVideo', validateBody, validateRequest, listOfFrames)

app.post('/createZip', validateBody, validateRequest, createZip)

app.post('/statusProcess', validateBody, validateID, statusProcess)
app.post('/cancelProcess', validateBody, validateID, cancelProcess)
app.post('/listProcess', listProcess)
app.post('/deleteProcess', validateBody, validateID, deleteProcess)

module.exports = app