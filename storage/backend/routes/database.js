var express    = require("express")

const app = express.Router()

const Pool = require("pg").Pool
const pool = new Pool({
	user: process.env.database_USER,
	host: process.env.database_HOST,
	database: process.env.database_NAME,
	password: process.env.database_PASSWORD,
	port: process.env.database_PORT,
})

const queryForHealth = () => {
	return pool.query("SELECT 2 + 2;")
}

app.get("/status", (req, res) => {
	queryForHealth().then(values => {
		if("rows" in values && values.rows.length > 0 && "?column?" in values.rows[0]){
			const shouldBeFour = values.rows[0]["?column?"]
			res.status( shouldBeFour == 4 ? 200 : 204 ).send({})
		}
		else{
			res.status(204).send({})
		}
	}).catch(err => {
		res.status(204).send({})
	})
})

module.exports = app