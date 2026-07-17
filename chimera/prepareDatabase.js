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
		description: "frame files table",
		table: "frame_files",
		columns: ["id", "timestamp", "camera", "name", "size"],
	},
	{
		query: "CREATE TABLE frame_deletes(ID SERIAL PRIMARY KEY, timestamp TIMESTAMPTZ, camera NUMERIC(10), size NUMERIC, count NUMERIC);",
		description: "frame deletions table",
		table: "frame_deletes",
		columns: ["id", "timestamp", "camera", "size", "count"],
	},
	{
		query: "CREATE TABLE auth(ID SERIAL PRIMARY KEY, username VARCHAR(50) UNIQUE, hash VARCHAR, role VARCHAR(10) NOT NULL DEFAULT 'user', last_login TIMESTAMPTZ, force_password_change BOOLEAN NOT NULL DEFAULT FALSE, temp_password_expires TIMESTAMPTZ, theme VARCHAR(10) DEFAULT 'system');",
		description: "authorization table",
		table: "auth",
		columns: ["id", "username", "hash", "role", "last_login", "force_password_change", "temp_password_expires", "theme"],
	},
	{
		query: "CREATE TABLE sessions(ID SERIAL PRIMARY KEY, username VARCHAR(50) REFERENCES auth(username) ON DELETE CASCADE, jti VARCHAR UNIQUE NOT NULL, issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), last_seen TIMESTAMPTZ, ip VARCHAR(45), user_agent TEXT, revoked BOOLEAN NOT NULL DEFAULT FALSE);",
		description: "sessions table",
		table: "sessions",
		columns: ["id", "username", "jti", "issued_at", "last_seen", "ip", "user_agent", "revoked"],
	},
	{
		query: "CREATE TABLE objects_detected(ID SERIAL PRIMARY KEY, camera NUMERIC(10), timestamp TIMESTAMPTZ DEFAULT NOW(), type VARCHAR(20), confidence NUMERIC(10, 6), box JSONB, image VARCHAR);",
		description: "objects detected table",
		table: "objects_detected",
		columns: ["id", "camera", "timestamp", "type", "confidence", "box", "image"],
	},
	{
		query: "CREATE TABLE task_runs(id SERIAL PRIMARY KEY, task_id TEXT NOT NULL, url TEXT NOT NULL, status TEXT NOT NULL, http_status INTEGER, error TEXT, ran_at TIMESTAMPTZ NOT NULL DEFAULT NOW());",
		description: "task runs table",
		table: "task_runs",
		columns: ["id", "task_id", "url", "status", "http_status", "error", "ran_at"],
	},
	{
		query: "CREATE TABLE scheduled_tasks(id TEXT PRIMARY KEY, url TEXT NOT NULL, body JSONB NOT NULL, cron_string TEXT NOT NULL, running BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());",
		description: "scheduled tasks table",
		table: "scheduled_tasks",
		columns: ["id", "url", "body", "cron_string", "running", "created_at"],
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
		query: "CREATE INDEX IF NOT EXISTS idx_task_runs_ran_at ON task_runs(ran_at);",
		description: "task runs (ran_at) index"
	},
	{
		query: "CREATE INDEX IF NOT EXISTS idx_sessions_username ON sessions(username);",
		description: "sessions (username) index"
	},
]

async function missingColumns(table, columns) {
	const { rows } = await pool.query(
		"SELECT column_name FROM information_schema.columns WHERE table_name = $1 AND table_schema = current_schema()",
		[table]
	)
	const existing = new Set(rows.map((r) => r.column_name))
	return columns.filter((c) => !existing.has(c))
}

async function runCreationTasks() {
	let issues = false
	for (const { query, description, table, columns } of creationTasks) {
		let ok
		let detail = ""
		try {
			await pool.query(query)
			ok = true
		} catch (e) {
			if (e && e.code == "42P07" && table) {
				try {
					const missing = await missingColumns(table, columns)
					ok = missing.length === 0
					if (!ok) detail = ` — missing columns: ${missing.join(", ")}. Run 'npm run docker:delete' to reset the database.`
				} catch (schemaError) {
					ok = false
					detail = ` — failed to verify schema: ${schemaError.message}`
				}
			} else {
				ok = false
				if (e) detail = ` — ${e.message || e.code || e}`
			}
		}
		if (!ok) issues = true
		console.log(`${description} ${ok ? "✔️" : "❌"}${detail}`)
	}
	return issues
}

module.exports = { creationTasks, missingColumns, runCreationTasks }

if (require.main === module) {
	runCreationTasks()
		.then((issues) => process.exit(issues ? 1 : 0))
		.catch((e) => {
			console.error(e)
			process.exit(1)
		})
}
