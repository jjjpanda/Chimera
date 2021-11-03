module.exports = {
    deprecation: (req, res) => {
        res.send({error: true, msg: "deprecated"})
    },

    construction: (req, res) => {
        res.send({error: true, msg: "⚠️ STILL IN CONSTRUCTION"})
    }
}