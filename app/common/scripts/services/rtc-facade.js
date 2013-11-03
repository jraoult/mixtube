(function (mt) {
    'use strict';

    mt.MixTubeCommon.factory('mtRtcFacade', function ($rootScope, $q, mtLoggerFactory) {

        // make TokBox more quiet
        TB.setLogLevel(TB.WARN);

        /**
         * @const
         * @type {string}
         */
        var OPENTOK_API_KEY = '44366222';

        /**
         * The session id is always the same for test purposes but that's not how it is supposed to work.
         *
         * @const
         * @type {string}
         */
        var STATIC_SESSION_ID = '2_MX40NDM2NjIyMn5-U3VuIE5vdiAwMyAwNTo0MTo1NSBQU1QgMjAxM34wLjMyNDE5OTJ-';
        /**
         * @const
         * @type {string}
         */
        var STATIC_SESSION_TOKEN = 'T1==cGFydG5lcl9pZD00NDM2NjIyMiZzZGtfdmVyc2lvbj10YnJ1YnktdGJyYi12MC45MS4yMDExLTAyLTE3JnNpZz0wMDAyNzMzNTk4NTMyOTVjOTlkMzc4MWRmYjVhOTU5YWM2YmQ5YzQ4OnJvbGU9cHVibGlzaGVyJnNlc3Npb25faWQ9Ml9NWDQwTkRNMk5qSXlNbjUtVTNWdUlFNXZkaUF3TXlBd05UbzBNVG8xTlNCUVUxUWdNakF4TTM0d0xqTXlOREU1T1RKLSZjcmVhdGVfdGltZT0xMzgzNDg2MTcwJm5vbmNlPTAuNjE4NTAxMTU3MTY4NDU1NCZleHBpcmVfdGltZT0xMzg2MDc4MTc1JmNvbm5lY3Rpb25fZGF0YT0=';

        var logger = mtLoggerFactory.logger('mtRtcFacade');

        var _data = {
            session: null,
            joiningSessionDeferred: null
        };

        var supported = TB.checkSystemRequirements() === 1;
        if (supported) {
            TB.addEventListener('exception', function (evt) {

                // connection-related events
                if (evt.code === 1006 || evt.code === 1008 || evt.code === 1014) {

                    // seems like the last attempted connection failed and we need to reject the session currently joining
                    if (_data.joiningSessionDeferred) {
                        $rootScope.$apply(function () {
                            _data.joiningSessionDeferred.reject(evt.message);
                            _data.joiningSessionDeferred = _data.session = null;
                        });
                    }
                } else {
                    logger.log('A global TokeBox exception was thrown with message: %s', evt.message);
                }
            });
        }

        return {

            /**
             * @returns {boolean} true if the platform is RTC capable
             */
            get supported() {
                return supported;
            },

            /**
             * Creates and joins a new session.
             *
             * @returns {promise} resolved with the session id
             */
            initiateSession: function () {
                var that = this;

                return $q.when(STATIC_SESSION_ID).then(function (sid) {
                    return that.joinSession(sid).then(function (session) {
                        return session.sessionId;
                    });
                });
            },

            /**
             * Joins the session matching the given id.
             *
             * @param {string} sessionId
             * @returns {promise} resolved with the session object when successfully joined
             */
            joinSession: function (sessionId) {
                var deferred = $q.defer();

                _data.session = TB.initSession(sessionId);
                _data.session.addEventListener('sessionConnected', function () {
                    $rootScope.$apply(function () {
                        deferred.resolve(_data.session);
                    });
                });

                // store the deferred so that the TokBox global exception handler above can reject it in case of error while connecting
                _data.joiningSessionDeferred = deferred;
                _data.session.connect(OPENTOK_API_KEY, STATIC_SESSION_TOKEN);

                return deferred.promise;
            },

            /**
             * Broadcasts a signal to all the members of the current session.
             *
             * @param {string} type the type of the signal. It is used to filter signals when received
             * @param {*} data the payload of the signal
             * @returns {promise} resolved when the broadcast is successfully sent or rejected with an error object else
             */
            broadcast: function (type, data) {
                var deferred = $q.defer();

                _data.session.signal(
                    {
                        type: type,
                        data: data,
                        success: function () {
                            $rootScope.$apply(function () {
                                deferred.resolve();
                            });
                        },
                        error: function (error) {
                            $rootScope.$apply(function () {
                                deferred.reject(error);
                            });
                        }
                    });

                return deferred.promise;
            },

            /**
             * Registers a callback function for a signal type called when the signal was received
             *
             * @param {string} type the signal type as given when calling the broadcast method
             * @param {function(*, string)} callback called with the data as first parameter when a signal is received, second parameter is the peer unique id
             */
            onSignal: function (type, callback) {
                _data.session.on('signal:' + type, function (evt) {
                    $rootScope.$apply(function () {
                        callback(evt.data, evt.from.id);
                    });
                });
            },

            /**
             * Registers a callback function called when the network connection terminated abruptly.
             *
             * @param {function()}callback
             */
            onNetworkDisconnected: function (callback) {
                _data.session.on('sessionDisconnected', function (evt) {
                    if (evt.reason === 'networkDisconnected') {
                        $rootScope.$apply(function () {
                            callback();
                        });
                    }
                });
            },

            /**
             * Registers a callback function called when peers left the session.
             *
             * @param {function(Array.<string>)} callback called with an array of peers unique ids as parameter
             */
            onPeerLeaved: function (callback) {
                _data.session.on('connectionDestroyed', function (evt) {
                    var connectionsIds = evt.connections.map(function (connection) {
                        return connection.id;
                    });

                    $rootScope.$apply(function () {
                        callback(connectionsIds);
                    });
                });
            }
        }
    });

})(mt);