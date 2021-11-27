const path       = require("path")
const imgDir = path.join(process.env.storage_FILEPATH, "shared/captures")

const fileList = [
    "output_1_20210101-235959_20210201-235959_video1-20210301-235959.mp4", 
    "output_1_20210101-235959_20210201-235959_video2-20210301-235959.mp4",
    "output_1_20210101-235959_20210201-235959_video3-20210301-235959.mp4",
    "mp4_video3-20210301-235959.txt",
    "output_1_20210101-235959_20210201-235959_zip1-20210301-235959.zip",
]

let fs = jest.requireActual('fs')
fs.readFile = jest.fn().mockImplementation((filePath, callback) => {
    callback(false, {})
})
fs.readdir = jest.fn().mockImplementation((filePath, callback) => {
    if(filePath == imgDir){
        callback(false, fileList)
    }
    else{
        callback(true, [])
    }
})
fs.stat = jest.fn().mockImplementation((filePath, callback) => {
    if(fileList.map(file => path.join(imgDir, file)).includes(filePath)){
        callback(false)
    }
    else{
        callback(true)
    }
})
fs.unlink = jest.fn().mockImplementation((filePath, callback) => {
    if(fileList.map(file => path.join(imgDir, file)).includes(filePath)){
        callback(false)
    }
    else{
        callback(true)
    }
})

module.exports = fs