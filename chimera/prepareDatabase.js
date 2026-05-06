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
	}
]

let issues = false

Promise.allSettled(creationTasks.map(({query}) => {
	return pool.query(query)
})).then(values => {
	values.forEach((value, index) => {
		const tableExists = value.status == "fulfilled" || (value.status == "rejected" && value.reason && value.reason.code == "42P07")
		if(!tableExists) issues = true
		console.log(`${creationTasks[index].description} ${tableExists ? "✔️" : "❌"}`)
	})
	return Promise.allSettled(migrationTasks.map(({query}) => pool.query(query)))
}).then(values => {
	values.forEach((value, index) => {
		const ok = value.status == "fulfilled"
		if(!ok) issues = true
		console.log(`${migrationTasks[index].description} ${ok ? "✔️" : "❌"}`)
	})
	process.exit(issues ? 1 : 0)
})