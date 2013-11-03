(function (mt) {
    'use strict';

    mt.MixTubeApp.factory('mtSharedQueueServerManager', function ($q, mtRtcFacade, mtQueueManager, mtYoutubeClient, mtAlert) {

        var _data = {
            /**
             * @type {string}
             */
            sharedQueueId: null,
            /**
             * @type {Object.<string, string>}
             */
            clientNameByPeerId: {}
        };

        /**
         * Appends the video matching the given id to the queue after checking it.
         *
         * @param {string} videoId the YouTube video id
         * @return {promise} resolved with the newly created {mt.model.QueueEntry} in case of success
         */
        function handleAppendVideo(videoId) {

            // check that the given video id matches a video in YouTube
            return mtYoutubeClient.listVideosByIds([videoId]).then(function (videos) {

                // listVideosByIds always returns videos but the valid ones have more than just the id property
                // so we check video properties presence to determine if something was found
                if (!videos[0].hasOwnProperty('publisherName')) {
                    return $q.reject();
                }

                // the given video matched a video on YouTube, we can append it to the queue
                return mtQueueManager.appendVideo(videos[0]);
            });
        }

        return {

            /**
             * Returns the shared queue id of this server.
             *
             * If there is no established session it starts a new one so that the current server is ready to accept
             * commands from peers through this session.
             *
             * @returns {promise} resolved with the shared queue id
             */
            getSharedQueue: function () {
                if (_data.sharedQueueId) {
                    return $q.when(_data.sharedQueueId);
                } else {
                    return mtRtcFacade.initiateSession().then(function (sid) {

                        _data.sharedQueueId = sid;

                        mtRtcFacade.onSignal('command', function (command, peerId) {

                            // accept the command only if the command peer has said hello before
                            if (_data.clientNameByPeerId.hasOwnProperty(peerId)) {

                                if (command.type === 'appendVideo') {
                                    handleAppendVideo(command.params.videoId).then(function (queueEntry) {
                                        var clientName = _data.clientNameByPeerId[peerId];
                                        mtAlert.info('"' + clientName + '" appended "' + queueEntry.video.title + '" to the queue', 5000);
                                    });
                                }
                            }
                        });

                        mtRtcFacade.onSignal('hello', function (clientName, peerId) {

                            // don't accept hello for already known peer, it could be an attempt to change the name which
                            // forbidden to avoid spamming
                            if (!_data.clientNameByPeerId.hasOwnProperty(peerId)) {

                                // link the peer id with the name so that we can reuse the name after and we know who said hello
                                _data.clientNameByPeerId[peerId] = clientName;
                                mtAlert.info('"' + clientName + '" entered the shared queue', 5000);
                            }
                        });

                        mtRtcFacade.onNetworkDisconnected(function () {
                            mtAlert.warning('The queue is not shared anymore because of a network disconnection', 5000);
                        });

                        mtRtcFacade.onPeerLeaved(function (peersIds) {
                            for (var idx = 0; idx < peersIds.length; idx++) {

                                var peerId = peersIds[idx];

                                if (_data.clientNameByPeerId.hasOwnProperty(peerId)) {

                                    var clientName = _data.clientNameByPeerId[peerId];
                                    mtAlert.info('"' + clientName + '" leaved the shared queue', 5000);

                                    // remove the disconnected peer from the map
                                    delete _data.clientNameByPeerId[peerId];
                                }
                            }
                        });

                        return _data.sharedQueueId;
                    });
                }
            }
        }
    });

})(mt);