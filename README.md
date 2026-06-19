# Chimera 

<img src="command/frontend/res/logo.png" alt="logo" width="100"/>

Chimera is a microservices-based security camera system for RTSP/IP cameras (Linux only).

List of microservices: 

1. [command](command)
2. [livestream](livestream)
3. [schedule](schedule)
4. [storage](storage)
5. [gateway](gateway)
6. [memory](memory)
7. [object](object)

Massive Dependencies:
1. [motion](https://github.com/Motion-Project/motion) - should be running on same machine as [storage](storage) server for optimal performance. See [storage](storage) as for why.
2. [ffmpeg](https://ffmpeg.org) - should be installed on same machine as [livestream](livestream) and [storage](storage). 
3. [heartbeat](https://github.com/jjjpanda/heartbeat) - used to confirm server is still up.
4. [postgres](https://www.postgresql.org) - the database

## Quick Start

### 1. Install motion, ffmpeg, and postgres
```
sudo apt-get install motion ffmpeg postgresql
```

Set up a **motion** conf with your cameras and a **postgres** database (name, port, user, password). Motion needs the postgres details in its conf too — [see storage](storage).

### 2. Create Environment Variables File

```
cp env.example .env
```

Fill in `.env` (leave optional fields blank after the `=`).

### 3. Run Setup

```
npm run setup
```

### 4. Start Chimera

If running all or more than one service(s)
```
npm start
```
If splitting services
```
npm run start:<service>
```