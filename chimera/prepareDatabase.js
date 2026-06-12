require("dotenv").config()
const Pool = require("pg").Pool
const pool = new Pool({
	user: process.env.database_USER,
	host: process.env.database_HOST,
	database: process.env.database_NAME,
	password: process.env.database_PASSWORD,
	port: process.env.database_PORT,
})

const creationTasks = [
	{
		query: "CREATE TABLE frame_files(ID SERIAL PRIMARY KEY, timestamp TIMESTAMP, camera NUMERIC(10), name VARCHAR, size NUMERIC);",
		description: "frame files table"
	},
	{
		query: "CREATE TABLE frame_deletes(ID SERIAL PRIMARY KEY, timestamp TIMESTAMP, camera NUMERIC(10), size NUMERIC, count NUMERIC);",
		description: "frame deletions table"
	},
	{
		query: "CREATE TABLE auth(ID SERIAL PRIMARY KEY, username VARCHAR(50) UNIQUE, hash VARCHAR, role VARCHAR(10) NOT NULL DEFAULT 'user', last_login TIMESTAMP);",
		description: "authorization table"
	},
	{
		query: "CREATE TABLE sessions(ID SERIAL PRIMARY KEY, username VARCHAR(50) REFERENCES auth(username) ON DELETE CASCADE, jti VARCHAR UNIQUE NOT NULL, issued_at TIMESTAMP NOT NULL DEFAULT NOW(), last_seen TIMESTAMP, ip VARCHAR(45), user_agent TEXT, revoked BOOLEAN NOT NULL DEFAULT FALSE);",
		description: "sessions table"
	}
]

let issues = false

;(async () => {
	for (const { query, description } of creationTasks) {
		let tableExists
		try {
			await pool.query(query)
			tableExists = true
		} catch (e) {
			tableExists = e && e.code == "42P07"
		}
		if (!tableExists) issues = true
		console.log(`${description} ${tableExists ? "✔️" : "❌"}`)
	}
	process.exit(issues ? 1 : 0)
})()