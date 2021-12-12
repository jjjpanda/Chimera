const path       = require("path")
const imgDir = path.join(process.env.storage_FOLDERPATH, "shared/captures")
const cameraDir = path.join(process.env.storage_FOLDERPATH, "shared/captures/1")

const fileList = [
    "20210101-000000-00.jpg",
    "20210101-030000-00.jpg",
    "20210101-060000-00.jpg",
    "20210101-090000-00.jpg",
    "20210101-120000-00.jpg",
    "20210101-150000-00.jpg",
    "20210101-180000-00.jpg",
    "20210101-210000-00.jpg",
    "20210102-000000-00.jpg",
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
    if(filePath == imgDir || filePath == cameraDir){
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