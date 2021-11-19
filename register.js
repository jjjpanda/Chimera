require("dotenv").config()
const { auth } = require("lib")

auth.register(() => {
    process.exit(0)
}, () => {
    process.exit(1)
})