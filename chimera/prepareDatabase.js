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
		query: "CREATE TABLE auth(ID SERIAL PRIMARY KEY, username VARCHAR(10) UNIQUE, hash VARCHAR);",
		description: "authorization table"
	}
]

const migrationTasks = [
	{
		query: "ALTER TABLE auth ALTER COLUMN username TYPE VARCHAR(50)",
		description: "auth username column widening"
	},
	{
		query: "ALTER TABLE auth ADD COLUMN IF NOT EXISTS role VARCHAR(10) NOT NULL DEFAULT 'user'",
		description: "auth role column"
	},
	{
		query: "UPDATE auth SET role = 'admin' WHERE id = (SELECT MIN(id) FROM auth) AND role = 'user'",
		description: "backfill first user as admin"
	}
]

let issues = false

Promise.allSettled(creationTasks.map(({query}) => {
	return pool.query(query)
})).then(async values => {
	values.forEach((value, index) => {
		const tableExists = value.status == "fulfilled" || (value.status == "rejected" && value.reason && value.reason.code == "42P07")
		if(!tableExists) issues = true
		console.log(`${creationTasks[index].description} ${tableExists ? "✔️" : "❌"}`)
	})
	for (const [index, {query}] of migrationTasks.entries()) {
		try {
			await pool.query(query)
			console.log(`${migrationTasks[index].description} ✔️`)
		} catch (e) {
			issues = true
			console.log(`${migrationTasks[index].description} ❌`)
		}
	}
	process.exit(issues ? 1 : 0)
})