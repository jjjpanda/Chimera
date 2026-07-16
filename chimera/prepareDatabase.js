require("dotenv").config()
const Pool = require("pg").Pool
const pool = new Pool({
	user: process.env.database_USER,
	host: process.env.database_HOST,
	database: process.env.database_NAME,
	password: process.env.database_PASSWORD,
	port: process.env.database_PORT,
	connectionTimeoutMillis: 5000,
})

const creationTasks = [
	{
		query: "CREATE TABLE frame_files(ID SERIAL PRIMARY KEY, timestamp TIMESTAMPTZ, camera NUMERIC(10), name VARCHAR, size NUMERIC);",
		description: "frame files table"
	},
	{
		query: "CREATE TABLE frame_deletes(ID SERIAL PRIMARY KEY, timestamp TIMESTAMPTZ, camera NUMERIC(10), size NUMERIC, count NUMERIC);",
		description: "frame deletions table"
	},
	{
		query: "CREATE TABLE auth(ID SERIAL PRIMARY KEY, username VARCHAR(50) UNIQUE, hash VARCHAR, role VARCHAR(10) NOT NULL DEFAULT 'user', last_login TIMESTAMPTZ, force_password_change BOOLEAN NOT NULL DEFAULT FALSE, temp_password_expires TIMESTAMPTZ, theme VARCHAR(10) DEFAULT 'system');",
		description: "authorization table"
	},
	{
		query: "CREATE TABLE sessions(ID SERIAL PRIMARY KEY, username VARCHAR(50) REFERENCES auth(username) ON DELETE CASCADE, jti VARCHAR UNIQUE NOT NULL, issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), last_seen TIMESTAMPTZ, ip VARCHAR(45), user_agent TEXT, revoked BOOLEAN NOT NULL DEFAULT FALSE);",
		description: "sessions table"
	},
	{
		query: "CREATE TABLE objects_detected(ID SERIAL PRIMARY KEY, camera NUMERIC(10), timestamp TIMESTAMPTZ DEFAULT NOW(), type VARCHAR(20), confidence NUMERIC(10, 6), box JSONB, image VARCHAR);",
		description: "objects detected table"
	},
	{
		query: "CREATE TABLE task_runs(id SERIAL PRIMARY KEY, task_id TEXT NOT NULL, url TEXT NOT NULL, status TEXT NOT NULL, http_status INTEGER, error TEXT, ran_at TIMESTAMPTZ NOT NULL DEFAULT NOW());",
		description: "task runs table"
	},
	{
		query: "CREATE TABLE scheduled_tasks(id TEXT PRIMARY KEY, url TEXT NOT NULL, body JSONB NOT NULL, cron_string TEXT NOT NULL, running BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());",
		description: "scheduled tasks table"
	},
	{
		query: "CREATE INDEX IF NOT EXISTS idx_frame_files_camera_timestamp ON frame_files(camera, timestamp);",
		description: "frame files (camera, timestamp) index"
	},
	{
		query: "CREATE INDEX IF NOT EXISTS idx_frame_files_timestamp ON frame_files(timestamp);",
		description: "frame files (timestamp) index"
	},
	{
		query: "CREATE INDEX IF NOT EXISTS idx_objects_detected_camera_timestamp ON objects_detected(camera, timestamp);",
		description: "objects detected (camera, timestamp) index"
	},
	{
		query: "CREATE INDEX IF NOT EXISTS idx_objects_detected_image ON objects_detected(image);",
		description: "objects detected (image) index"
	},
	{
		query: "CREATE INDEX IF NOT EXISTS idx_task_runs_ran_at ON task_runs(ran_at);",
		description: "task runs (ran_at) index"
	},
	{
		query: "CREATE INDEX IF NOT EXISTS idx_sessions_username ON sessions(username);",
		description: "sessions (username) index"
	},
]

module.exports = { creationTasks }

if (require.main === module) {
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
}