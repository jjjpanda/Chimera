require('dotenv').config({path: "../../../.env"}) // delete later
const Pool = require('pg').Pool
const pool = new Pool({
    user: process.env.database_USER,
    host: process.env.database_HOST,
    database: process.env.database_NAME,
    password: process.env.database_PASSWORD,
    port: process.env.database_PORT,
})

pool.query('SELECT * FROM frame_files', (error, results) => {
    if (error) {
      throw error
    }
    console.log(results.rows)
})