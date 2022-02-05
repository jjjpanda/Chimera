# Chimera 

<img src="command/frontend/res/logo.png" alt="logo" width="100"/>

Chimera is a microservices based security camera system for RTSP/IP cameras *(which kinda sorta only runs on linux)*

List of microservices: 

1. [command](command)
2. [livestream](livestream)
3. [schedule](schedule)
4. [storage](storage)
5. [gateway](gateway)
6. [memory](memory)

Massive Dependencies:
1. [motion](https://github.com/Motion-Project/motion) - should be running on same machine as [storage](storage) server for optimal performance. See [storage](storage) as for why.
2. [ffmpeg](https://ffmpeg.org) - should be installed on same machine as [livestream](livestream) and [storage](storage). 
3. [heartbeat](https://github.com/jjjpanda/heartbeat) - used to confirm server is still up.
4. [object](https://github.com/jjjpanda/object) - used to detect objects (still not implemented within start script).
5. [postgres](https://www.postgresql.org) - the database

## Quick Start

### 1. Install motion, ffmpeg, and postgres
```
sudo apt-get install motion ffmpeg postgresql
```

*Or however you need to download it on your machine*

Then, set up a conf for **motion** with all of your cameras. Then, set up **postgres** with a database, port, user, and password of your choosing. **Motion** will also need postgres details in it's conf as well. [*See storage for details.*](storage) 

### 2. Create Environment Variables File

Copy the example env into an .env dotfile:
```
cp env.example .env
```

Fill in the .env with all the info listed ( for optional fields, leave blank after the "=" ). 

### 3. Installing NPM dependencies

```
npm install
```

### 4. Run Build

```
npm run build
```

### 5. Start Chimera

If running all or more than one service(s)
```
npm start
```
If splitting services
```
npm run start:<service>
```