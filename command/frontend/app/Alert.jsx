import {
	Modal
} from "antd-mobile"


const alertModal = (title, msg, okCallback) => Modal.alert(title, msg, [
	{ text: "Cancel", onPress: () => {}, style: "default" },
	{ text: "Ok", onPress: okCallback}
])

export default alertModal