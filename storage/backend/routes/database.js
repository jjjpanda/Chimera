var express    = require("express")

const app = express.Router()

const pool = require("../lib/pool")

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