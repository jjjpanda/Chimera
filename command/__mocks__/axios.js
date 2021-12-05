module.exports = {
    default: {
        create: () => ({
            post: (url, data, other) => {
                return new Promise(resolve => {
                    resolve(data)
                })
            }
        })
    }
}