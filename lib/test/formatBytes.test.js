const formatBytes = require('../utils/formatBytes.js')

describe("Testing Byte Formatting", () => {
    test('1024 Bytes = 1 KB', (done) => {
        expect(formatBytes(1024)).toBe("1 KB")
        done()
    });
})