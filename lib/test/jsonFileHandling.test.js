const jsonFileHanding = require("../utils/jsonFileHandling")

let fs = require("fs")
fs.readFile = jest.fn().mockImplementation((filePath, callback) => {
	if(filePath == "/nonexistent/file/path"){
		callback(true)
	}
	else if(filePath == "/file/path/notajson.txt"){
		callback(false, {})
	}
	else if(filePath == "/file/path/json.json"){
		callback(false, "{\"bruh\":true,\"moment\":\"definitely\",\"bonk\":53470}")
	}
})
fs.writeFile = jest.fn().mockImplementation((filePath, data, callback) => {
	if(filePath == "/nonexistent/file/path"){
		callback(true)
	}
	else {
		callback(false)
	}
})

describe("JSON File Handling Tests", () => {
	describe("Reading", () => {
		test("trying to read json from a file that doesn't exist", (done) => {
			jsonFileHanding.readJSON("/nonexistent/file/path", (err, data) => {
				expect(err).toBeTruthy()
				expect(data).toMatchObject({})
				done()
			})
		})

		test("trying to read json from a file that isn't a JSON", (done) => {
			jsonFileHanding.readJSON("/file/path/notajson.txt", (err, data) => {
				expect(err).toBeFalsy()
				expect(data).toMatchObject({})
				done()
			})
		})

		test("read json from a file that IS a JSON", (done) => {
			jsonFileHanding.readJSON("/file/path/json.json", (err, data) => {
				expect(err).toBeFalsy()
				expect(data).toMatchObject({"bruh":true,"moment":"definitely","bonk":53470})
				done()
			})
		})
	})

	describe("Writing", () => {
		test("trying to write json to a file path that doesn't exist", (done) => {
			jsonFileHanding.writeJSON("/nonexistent/file/path", {}, (err) => {
				expect(err).toBeTruthy()
				done()
			})
		})

		test("write json to a file", (done) => {
			jsonFileHanding.writeJSON("json.json", {}, (err) => {
				expect(err).toBeFalsy()
				done()
			})
		})
	})
})