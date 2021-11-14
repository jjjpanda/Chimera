# Schedule <img src="../command/frontend/res/logo.png" alt="logo" width="20"/> 

The scheduler is pretty self explanatory. You need a task scheduled? Done.

## ▶ /task

|Type|Route|Description|Parameters|Returns|
| :-|:- |:-:|:-:|:-:|
|POST|/start|Schedules a task|`{ id: String, url: String, body: JSON, cronString: String }`|`{ running: Boolean }`|
|GET|/list|Checks details of tasks|None|`{ tasks: [TaskObj] }`|
|POST|/stop|Stops a task|`{ url: String }`|`{ stopped: Boolean }`|
|POST|/destroy|Destroys a task|`{ url: String }`|`{ destroyed: Boolean }`|

```javascript
// id = task-[RandomAlphaNumeric]

//TaskObj
{
    id: String, // id
    url: String,
    body: Object,
    cronString: String,
    running: Boolean,
    task: Object //node-cron object
}
```

## ▶ /schedule

|Type|Route|Description|Parameters|Returns|
| :-|:- |:-:|:-:|:-:|
|GET|/health|Confirms server alive|N/A|N/A|