module.exports = [{
    serviceOn: process.env.storage_PROXY_ON === "true",
    log: "📂 Storage Proxied ◀",
    baseURL: `http://${process.env.storage_HOST}/`,
    postPathRegex: /\/convert\/(.*Video|.*Zip|.*Process)|\/file\/path.*|\/motion\/.*/,
    getPathRegex: /\/shared\/.*|\/file\/path.*|\/motion\/.*|\/storage\/health/
}, {
    serviceOn: process.env.schedule_PROXY_ON === "true",
    log: "⌚ Scheduler Proxied ◀",
    baseURL: `http://${process.env.schedule_HOST}/`,
    postPathRegex: /\/task\/.*/,
    getPathRegex: /\/schedule\/health/
}, {
    serviceOn: process.env.livestream_PROXY_ON === "true",
    log: "👀 Livestream Proxied ◀",
    baseURL: `http://${process.env.livestream_HOST}/`,
    postPathRegex: /\/livestream\/.*/,
    getPathRegex: /\/livestream\/.*/
}]