const ort = require("onnxruntime-node")
const { ensureModel } = require("./model.js")

const INPUT = parseInt(process.env.object_INPUT_SIZE) || 416
const STRIDES = [8, 16, 32]

const COCO = [
	"person", "bicycle", "car", "motorcycle", "airplane", "bus", "train", "truck", "boat", "traffic light",
	"fire hydrant", "stop sign", "parking meter", "bench", "bird", "cat", "dog", "horse", "sheep", "cow",
	"elephant", "bear", "zebra", "giraffe", "backpack", "umbrella", "handbag", "tie", "suitcase", "frisbee",
	"skis", "snowboard", "sports ball", "kite", "baseball bat", "baseball glove", "skateboard", "surfboard", "tennis racket", "bottle",
	"wine glass", "cup", "fork", "knife", "spoon", "bowl", "banana", "apple", "sandwich", "orange",
	"broccoli", "carrot", "hot dog", "pizza", "donut", "cake", "chair", "couch", "potted plant", "bed",
	"dining table", "toilet", "tv", "laptop", "mouse", "remote", "keyboard", "cell phone", "microwave", "oven",
	"toaster", "sink", "refrigerator", "book", "clock", "vase", "scissors", "teddy bear", "hair drier", "toothbrush"
]

let sessionPromise = null

const load = () => {
	if (!sessionPromise) {
		sessionPromise = ensureModel().then((modelPath) => ort.InferenceSession.create(modelPath))
	}
	return sessionPromise
}

const iou = (a, b) => {
	const ax2 = a.box[0] + a.box[2], ay2 = a.box[1] + a.box[3]
	const bx2 = b.box[0] + b.box[2], by2 = b.box[1] + b.box[3]
	const ix = Math.max(0, Math.min(ax2, bx2) - Math.max(a.box[0], b.box[0]))
	const iy = Math.max(0, Math.min(ay2, by2) - Math.max(a.box[1], b.box[1]))
	const inter = ix * iy
	const union = a.box[2] * a.box[3] + b.box[2] * b.box[3] - inter
	return union <= 0 ? 0 : inter / union
}

const nms = (boxes, threshold = 0.45) => {
	const sorted = boxes.slice().sort((a, b) => b.score - a.score)
	const kept = []
	for (const box of sorted) {
		if (kept.every((k) => k.class !== box.class || iou(k, box) < threshold)) kept.push(box)
	}
	return kept
}

const sizeFromAnchors = (anchors) => Math.round(Math.sqrt(anchors * 1024 / 21))

const parse = (output, confidence) => {
	const data = output.data
	const numChannels = output.dims[2]
	const numClasses = numChannels - 5
	const size = sizeFromAnchors(output.dims[1])
	const boxes = []
	let i = 0
	for (const stride of STRIDES) {
		const grid = Math.round(size / stride)
		for (let gy = 0; gy < grid; gy++) {
			for (let gx = 0; gx < grid; gx++, i++) {
				const o = i * numChannels
				const obj = data[o + 4]
				let best = 0, bestScore = 0
				for (let c = 0; c < numClasses; c++) {
					const score = data[o + 5 + c]
					if (score > bestScore) { bestScore = score; best = c }
				}
				const score = obj * bestScore
				if (score < confidence) continue
				const cx = (data[o] + gx) * stride
				const cy = (data[o + 1] + gy) * stride
				const w = Math.exp(data[o + 2]) * stride
				const h = Math.exp(data[o + 3]) * stride
				boxes.push({ class: COCO[best] || String(best), score, box: [cx - w / 2, cy - h / 2, w, h] })
			}
		}
	}
	return nms(boxes)
}

const detect = async (tensorData, confidence) => {
	const s = await load()
	const input = new ort.Tensor("float32", tensorData, [1, 3, INPUT, INPUT])
	const result = await s.run({ [s.inputNames[0]]: input })
	return parse(result[s.outputNames[0]], confidence)
}

module.exports = { detect, parse, nms, load, COCO, INPUT }
