# Mixtube

Mixtube is a web application that let you create queues of videos and automatically cross-fades them so that you get a
continuous stream of music. The only compatible video provider for now is YouTube but more will be added.

## Getting started
For now, the only way to try Mixtube is to clone the GitHub repo and run the "server" Grunt task.

## Branch specific
This branch purpose is to test [OpenTok API](http://tokbox.com/opentok) integration. By leveraging OT signal API, "clients"
can connect to a queue and append new video. Currently, by clicking "Share the control of this queue" the user connects to a predefined OT session. The queue then listens
for command from clients to append videos.

For now, the session is pre-created thanks to the OT dashboard and fixed in the code but the goal is to generate a new
session dynamically each time thanks to a server side component.
