const formatBytes = require('../utils/formatBytes.js')

describe("Testing Byte Formatting", () => {
    test('0 Bytes is, well, 0 Bytes', (done) => {
        expect(formatBytes(0)).toBe("0 Bytes")
        expect(formatBytes(0, 999999999)).toBe("0 Bytes")
        done()
    });

    test('1000 Bytes is not a Kilobyte!', (done) => {
        expect(formatBytes(100)).toBe("100 Bytes")
        done()
    });

    test('1024 Bytes = 1 KB, 1024 KB = 1 MB, ...', (done) => {
        expect(formatBytes(1024)).toBe("1 KB")
        expect(formatBytes(1024 ** 2)).toBe("1 MB")
        expect(formatBytes(1024 ** 3)).toBe("1 GB")
        expect(formatBytes(1024 ** 4)).toBe("1 TB")
        expect(formatBytes(1024 ** 5)).toBe("1 PB")
        expect(formatBytes(1024 ** 6)).toBe("1 EB")
        expect(formatBytes(1024 ** 7)).toBe("1 ZB")
        expect(formatBytes(1024 ** 8)).toBe("1 YB")
        done()
    });

    test('2000 Bytes = 1.95 KB', (done) => {
        expect(formatBytes(2000)).toBe("1.95 KB")
        done()
    });

    test('actually, 2000 Bytes = 1.953125 KB', (done) => {
        expect(formatBytes(2000, 8)).toBe("1.953125 KB")
        done()
    });

    test('2000 Bytes ~ 2 KB', (done) => {
        expect(formatBytes(2000, 0)).toBe("2 KB")
        done()
    });
})