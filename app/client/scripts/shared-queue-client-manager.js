(function (mt) {
    'use strict';

    mt.MixTubeClientApp.factory('mtSharedQueueClientManager', function (mtRtcFacade) {

        return {

            /**
             * Joins an shared queue so that this client can control it.
             *
             * @param {string} sharedQueueId the id of the shared queue to join
             * @returns {promise} resolved when successfully joined
             */
            joinSharedQueue: function (sharedQueueId) {

                // in this case the shared queue id is just the RTC session id
                return mtRtcFacade.joinSession(sharedQueueId);
            },

            /**
             * Sends message to the server to announce that we are now connected to the shared queue.
             *
             * @param {string} clientName the name of the client that will be shown to the peers.
             * @returns {promise} resolved when the request is successfully sent or rejected with an error object else
             */
            sayHello: function (clientName) {
                return mtRtcFacade.broadcast('hello', clientName);
            },

            /**
             * Sends a request to the server to append a video to the queue.
             *
             * @param {string} videoId the video id
             * @returns {promise} resolved when the request is successfully sent or rejected with an error object else
             */
            appendVideo: function (videoId) {
                return mtRtcFacade.broadcast('command',
                    {
                        type: 'appendVideo',
                        params: {
                            videoId: videoId
                        }
                    });
            }
        }
    });

})(mt);