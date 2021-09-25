import { 
  Toast
} from 'antd-mobile';

import { saveAs } from 'file-saver';
import { call } from 'file-loader';

const request = (url, opt, callback) => {
    callback(fetch(url, opt))
}

const jsonProcessing = (prom, callback) => {
    prom
    .then(res => {
      console.log(res)
      return res.text()
    })
    .then((res) => {
      try {
        const resp = JSON.parse(res)
        return resp
      } catch (e) {
        console.log("ERROR", e, res)
        return res
      }
    })
    .then((data) => callback(data))
    .catch(e => callback(undefined))
}

const downloadProcessing = (prom, callback) => {
  prom.then(resp => {
      return resp.blob()
  }).then(blob => {
      //console.log(blob)
      const fr = new FileReader();
      fr.onload = function() {
          let res 
          try {
            res = JSON.parse(this.result)
          } catch (e) {
            res = undefined
          }

          console.log(res)

          if(res != undefined){
              if(res.frameLimitMet){
                setTimeout(() => {
                  Toast.fail("Size Limit Met", 0)
                }, 2500)
              }
              else if(res.url == undefined){
                setTimeout(() => {
                  Toast.fail("No Frames", 0)
                }, 2500)
              }
              setTimeout(() => {
                Toast.hide()
                callback()
              }, 5000)  
          }
          else{
            saveAs(blob)
            Toast.hide()
          }
      };                        
      fr.readAsText(blob);
  })
}

export {request, jsonProcessing, downloadProcessing}