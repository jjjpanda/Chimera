const app = require('./app.js')



if(process.env.storage == "on"){
    console.log("Storage 📂 On")

    app.use('/convert', require('./subServers/storage.js'))
    
    app.use('/shared', serveStatic(path.join(process.env.filePath, 'shared'), {
        index: false,
        setHeaders: (res, path) => {
            res.setHeader('Content-Disposition', contentDisposition(path))
        },
    }),
    express.static(path.join(process.env.filePath, 'shared')), serveIndex(path.join(process.env.filePath, 'shared'), {
        icons: true,
        stylesheet: path.resolve(__dirname, '../templates/fileStyle.css'),
        template: path.resolve(__dirname, '../templates/fileTemplate.html')
    }))
}

if(process.env.schedule == "on"){
    console.log("Schedule ⌚ On")

    app.use('/schedule', require('./subServers/schedule.js'))
}

if(process.env.command == "on"){
    console.log("Command 🎮 On")

    app.use('/command', require('./subServers/command.js'))
    app.use('/res', express.static(path.join(__dirname, '../../frontend/res')));
    app.use('/', express.static(path.resolve(__dirname, "../../dist/"), {
        index: "app.html"
    }))
}

module.exports = () => {
    
    register(
        () => app.listen(process.env.PORT), 
        () => console.log("😭 Server NOT started... 🥺")
    );

}