(function (mt) {
    'use strict';

    mt.MixTubeApp.factory('mtPlaybackSlotFactory', function ($rootScope, $q, mtMediaElementsPool, mtQueueManager, mtLoggerFactory) {

        var logger = mtLoggerFactory('mtPlaybackSlotFactory');

        /**
         * @param {mt.model.QueueEntry} queueEntry
         * @constructor
         */
        function Player(queueEntry) {
            this._mediaElementWrapper = mtMediaElementsPool(queueEntry.video.provider);
            this.popcorn = Popcorn(this._mediaElementWrapper.get());
            this._queueEntry = queueEntry;
            this._disposed = false;
        }

        Player.prototype = {
            load: function () {
                var queueEntry = this._queueEntry;
                if (queueEntry.video.provider === 'youtube') {
                    this._mediaElementWrapper.get().src = 'http://www.youtube.com/watch?v=' + queueEntry.video.id;
                } else {
                    throw new Error('Unknown video provider type ' + queueEntry.video.provider);
                }
            },

            dispose: function () {
                if (!this._disposed) {
                    this._disposed = true;
                    this.popcorn.destroy();
                    this._mediaElementWrapper.release();
                    this.popcorn = null;
                    this._mediaElementWrapper = null;
                    this._queueEntry = null;
                }
            }
        };

        /**
         * @param {Playback} playback
         * @constructor
         */
        function PlaybackSlot(playback) {
            this._playback = playback;
            this._player = null;
            this._started = false;
            this._stopOutCalled = false;
            this._finishCalled = false;
            this._prepareDeferred = $q.defer();
            this._finishedDeferred = $q.defer();
            this._tryingQueueEntry = null;
            this._actualQueueEntry = null;
        }

        PlaybackSlot.FADE_DURATION = 3;
        PlaybackSlot.AUTO_END_CUE_ID = 'PlaybackSlotAutoEndCue';
        PlaybackSlot.AUTO_END_CUE_TIME_PROVIDER = function (duration) {
            return 15;
        };
        PlaybackSlot.PREPARE_RETRY = function (queueEntryToTry, prepareDeferred) {

            prepareDeferred.notify(queueEntryToTry);

            if (!queueEntryToTry) {
                prepareDeferred.reject(new Error('Could not find any valid entry to prepare'));
            }

            var player = new Player(queueEntryToTry);

            player.popcorn.on('error', function prepareErrorCb() {
                $rootScope.$apply(function () {
                    logger.warn('Skipped %O because of an error when trying to load it: %O', queueEntryToTry, player.popcorn.media.error);

                    player.dispose();
                    queueEntryToTry.skippedAtRuntime = true;
                    PlaybackSlot.PREPARE_RETRY(mtQueueManager.closestValidEntry(queueEntryToTry), prepareDeferred);
                });
            });

            player.popcorn.one('canplay', function prepareCanPlayCb() {
                $rootScope.$apply(function () {
                    // makes really sure a call to play will start the video instantaneously by forcing the player to buffer
                    player.popcorn.play();
                    player.popcorn.one('playing', function preparePlayingCb() {
                        player.popcorn.pause();

                        // last try was successful so send a last progress info to tell that we are not trying anything else
                        prepareDeferred.notify(null);

                        // make sure the player is disposed if the preparation has been canceled
                        prepareDeferred.promise.catch(function () {
                            player.dispose();
                        });
                        // depending of the state of the deferred this might have no effect
                        prepareDeferred.resolve({player: player, preparedQueueEntry: queueEntryToTry});
                    });
                });
            });

            player.load();
        };

        PlaybackSlot.prototype = {

            get tryingQueueEntry() {
                return this._tryingQueueEntry;
            },

            get actualQueueEntry() {
                return this._actualQueueEntry;
            },

            get finishedPromise() {
                return this._finishedDeferred.promise;
            },

            /**
             * Tries to load the video of the given entry. If this video is not valid, it browse to cue in incrementally
             * until it finds a valid queue entry.
             *
             * This method is responsible for marking queue entry as skipped in case of error while loading.
             *
             * @param {mt.model.QueueEntry} expectedQueueEntry
             */
            prepareSafe: function (expectedQueueEntry) {
                var slot = this;

                slot._prepareDeferred.promise.then(function successCb(args) {
                    slot._actualQueueEntry = args.preparedQueueEntry;
                }, null, function progressCb(tryingQueueEntry) {
                    slot._tryingQueueEntry = tryingQueueEntry;
                });

                PlaybackSlot.PREPARE_RETRY(
                    mtQueueManager.closestValidEntry(expectedQueueEntry, true),
                    slot._prepareDeferred
                );

                return this;
            },

            /**
             * @param {function} aboutToStartCb
             * @param {function} aboutToEndCb
             */
            engage: function (aboutToStartCb, aboutToEndCb) {
                var slot = this;
                slot._prepareDeferred.promise.then(function setupPlayer(args) {
                    slot._player = args.player;

                    slot._player.popcorn.cue(
                        PlaybackSlot.AUTO_END_CUE_ID,
                        PlaybackSlot.AUTO_END_CUE_TIME_PROVIDER(slot._player.popcorn.duration()),
                        function autoEndCueCb() {
                            $rootScope.$apply(function () {
                                logger.debug('auto ending %O', slot._actualQueueEntry.video);
                                aboutToEndCb();
                                slot.finish();
                            });
                        });

                    aboutToStartCb();
                    slot._startIn();
                });

                return this;
            },

            finish: function () {
                this._finishCalled = true;
                if (!this._player) {
                    // player is set when _prepareDeferred is resolved so here we now that we can still reject it
                    this._prepareDeferred.reject(new Error('The PlaybackSlot has been finished before the end of preparation'));
                    this._finishedDeferred.resolve();
                } else if (!this._started) {
                    // this will ensure a player is never returned and properly disposed
                    this._player.dispose();
                    this._finishedDeferred.resolve();
                } else if (!this._stopOutCalled) {
                    this._player.popcorn.removeTrackEvent(PlaybackSlot.AUTO_END_CUE_ID);
                    this._stopOut();
                }
            },

            _startIn: function () {
                var slot = this;
                slot._playback.whenPlaying(function startInWhenPlaying() {
                    // slot might have been finished while we were waiting for play, better to check first
                    if (!slot._finishCalled) {
                        slot._started = true;
                        var popcorn = slot._player.popcorn;
                        slot._playback.onPause.add(popcorn.pause, popcorn);
                        slot._playback.onResume.add(popcorn.play, popcorn);

                        popcorn.play();
                        popcorn.fade({direction: 'in', duration: PlaybackSlot.FADE_DURATION});
                    }
                });
            },

            _stopOut: function () {
                var slot = this;
                slot._stopOutCalled = true;
                slot._player.popcorn.fade({direction: 'out', duration: PlaybackSlot.FADE_DURATION, done: function () {
                    $rootScope.$apply(function () {
                        var popcorn = slot._player.popcorn;
                        slot._playback.onPause.remove(popcorn.pause, popcorn);
                        slot._playback.onResume.remove(popcorn.play, popcorn);
                        slot._player.dispose();

                        slot._finishedDeferred.resolve();
                    });
                }});
            }
        };


        return function playbackSlot(playback) {
            return new PlaybackSlot(playback);
        };
    });

})(mt);