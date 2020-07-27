document.getElementById('on').addEventListener('click', () => {
    fetch("/on", {
        method: "POST"
    })
})

document.getElementById('off').addEventListener('click', () => {
    fetch("/off", {
        method: "POST"
    })
})

document.getElementById('motion').addEventListener('click', () => {
    fetch("/motion", {
        method: "POST"
    })
})

document.getElementById('kill').addEventListener('click', () => {
    fetch("/kill", {
        method: "POST"
    })
})