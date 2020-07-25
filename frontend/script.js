document.getElementById('on').addEventListener('click', () => {
    fetch("/on", {
        method: "GET"
    })
})

document.getElementById('off').addEventListener('click', () => {
    fetch("/off", {
        method: "GET"
    })
})

document.getElementById('kill').addEventListener('click', () => {
    fetch("/kill", {
        method: "GET"
    })
})