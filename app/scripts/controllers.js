'use strict';

var angular = require('angular');

// brfs requires this to be on its own line
var fs = require('fs');

// @ngInject
function RootCtrl($scope, $location, $timeout, $templateCache, keyboardShortcutManager, queueManager,
                  notificationCentersRegistry, orchestrator, userInteractionManager, queuesRegistry, modalManager,
                  capabilities, searchCtrlHelper, configuration) {

  var rootCtrl = this;

  /**
   * Stores the serialized version of the queue. Useful to check the new url state against the internal state
   * to prevent infinite loops when changing the url internally.
   *
   * @type {string}
   */
  var serializedQueue;

  // a combination of detected capability and user override
  var playbackCapable = true;

  // we need to track if the modal is open to make sure we don't "idle" the chrome
  var modalOpen = false;

  rootCtrl.queueLoading = false;

  rootCtrl.isSearchShown = isSearchShown;
  rootCtrl.getQueue = getQueue;
  rootCtrl.getRunningQueueEntry = getRunningQueueEntry;
  rootCtrl.getLoadingQueueEntry = getLoadingQueueEntry;
  rootCtrl.isPlaying = isPlaying;
  rootCtrl.shouldIdleChrome = shouldIdleChrome;
  rootCtrl.shouldShowScene = shouldShowScene;
  rootCtrl.shouldShowPlaybackControls = shouldShowPlaybackControls;
  rootCtrl.toggleSearch = searchCtrlHelper.toggleSearch;
  rootCtrl.togglePlayback = togglePlayback;

  // setup direct access to the property for double binding
  Object.defineProperty(rootCtrl, 'searchTerm', {
    get: function() {
      return searchCtrlHelper.searchTerm;
    },
    set: function(value) {
      searchCtrlHelper.searchTerm = value;
    }
  });

  function isSearchShown() {
    return searchCtrlHelper.searchShown;
  }

  function getQueue() {
    return queueManager.queue;
  }

  function getRunningQueueEntry() {
    return orchestrator.runningQueueEntry;
  }

  function getLoadingQueueEntry() {
    return orchestrator.loadingQueueEntry;
  }

  function isPlaying() {
    return orchestrator.playing;
  }

  function shouldIdleChrome() {
    return !configuration.forceChrome && !userInteractionManager.userInteracting && !modalOpen && orchestrator.playing;
  }

  function shouldShowScene() {
    return playbackCapable;
  }

  function shouldShowPlaybackControls() {
    return playbackCapable || capabilities.remoteControl;
  }

  function togglePlayback() {
    orchestrator.togglePlayback();
  }

  // we need to wait for the loading phase to be done to avoid race problems (loading for ever)
  $timeout(activate);

  function activate() {
    // hide the input search at startup
    searchCtrlHelper.toggleSearch(false);

    // register the global space shortcut
    keyboardShortcutManager.register('space', function(evt) {
      evt.preventDefault();
      orchestrator.togglePlayback();
    });

    keyboardShortcutManager.register('search', 'esc', function(evt) {
      evt.preventDefault();
      searchCtrlHelper.toggleSearch(false);
    });

    // prevents the backspace shortcut
    // it is really easy to inadvertently hit the key and  triggers a "Go Back" action
    keyboardShortcutManager.register('backspace', function(evt) {
      evt.preventDefault();
    });

    $scope.$watch(function() {
      return queueManager.queue;
    }, function(newVal, oldVal) {
      // this test is here to prevent to serialize during the init phase
      if (newVal !== oldVal) {
        var newSerializedQueue = queueManager.serialize();
        if (serializedQueue !== newSerializedQueue) {
          serializedQueue = newSerializedQueue;
          // replace queue parameter but keep the rest
          $location.search(angular.extend({}, $location.search(), {queue: serializedQueue}));
        }
      }
    }, true);

    $scope.$watch(function() {
      return $location.search().queue;
    }, function(newSerializedQueue) {
      if (serializedQueue !== newSerializedQueue) {
        serializedQueue = newSerializedQueue;
        // change initiated by user (back / forward etc.), need to be deserialized
        rootCtrl.queueLoading = true;
        queueManager.deserialize(serializedQueue).catch(function(message) {
          notificationCentersRegistry('notificationCenter').ready(function(notificationCenter) {
            notificationCenter.error(message);
          });
        }).finally(function() {
          rootCtrl.queueLoading = false;
        });
      }
    });

    $scope.$watch(function() {
      return orchestrator.runningQueueEntry;
    }, function(runningQueueEntry, oldVal) {
      if (runningQueueEntry !== oldVal) {
        queuesRegistry('queue').ready(function(queue) {
          queue.focusEntry(runningQueueEntry);
        });
      }
    });

    // pre-fill the template cache with the content of the modal
    $templateCache.put('noPlaybackModalContent',
      fs.readFileSync(__dirname + '/components/capabilities/noPlaybackModalContent.html', 'utf8'));

    $scope.$watch(function() {
      return capabilities.playback;
    }, function(playback) {
      if (playback === false) {
        modalOpen = true;
        modalManager.open({
            title: 'MixTube won\'t work on your device',
            contentTemplateUrl: 'noPlaybackModalContent',
            commands: [{label: 'OK', primary: true, name: 'ok'}]
          })
          .then(function(command) {
            playbackCapable = command.name === 'try';
          })
          .finally(function() {
            modalOpen = false;
          });
      }
    });
  }
}

// @ngInject
function SearchResultsCtrl(searchCtrlHelper) {

  var searchResultsCtrl = this;

  searchResultsCtrl.shouldShowSearchResultPanel = shouldShowSearchResultPanel;
  searchResultsCtrl.shouldShowSpinner = shouldShowSpinner;
  searchResultsCtrl.shouldShowLoadingError = shouldShowLoadingError;
  searchResultsCtrl.shouldShowNotFound = shouldShowNotFound;
  searchResultsCtrl.shouldShowShowMore = shouldShowShowMore;
  searchResultsCtrl.shouldShowShowMoreSpinner = shouldShowShowMoreSpinner;
  searchResultsCtrl.showMore = showMore;

  Object.defineProperties(searchResultsCtrl, {
    searchTerm: {
      get: function() {
        return searchCtrlHelper.searchTerm;
      }
    },

    results: {
      get: function() {
        return searchCtrlHelper.searchResultsData.results;
      }
    },

    availableProviders: {
      get: function() {
        return {youtube: 'YouTube'};
      }
    }
  });

  function shouldShowSearchResultPanel() {
    return searchCtrlHelper.shouldShowSearchResultPanel();
  }

  function shouldShowSpinner(provider) {
    return searchCtrlHelper.searchResultsData.pending[provider];
  }

  function shouldShowShowMore(provider) {
    return !!searchCtrlHelper.searchResultsData.nextPageId[provider];
  }

  function shouldShowShowMoreSpinner(provider) {
    return searchCtrlHelper.searchResultsData.pendingMore[provider];
  }

  function shouldShowLoadingError(provider) {
    return searchCtrlHelper.searchResultsData.error[provider];
  }

  function shouldShowNotFound(provider) {
    return searchCtrlHelper.searchResultsData.noneFound[provider];
  }

  function showMore(pId) {
    searchCtrlHelper.showMore(pId, searchCtrlHelper.searchResultsData.nextPageId[pId]);
  }
}

// @ngInject
function SearchResultCtrl($timeout, queueManager, queuesRegistry, orchestrator) {

  var searchResultCtrl = this;

  /**
   * @const
   * @type {number}
   */
  var CONFIRMATION_DURATION = 4000;

  /** @type {?Promise} */
  var tmoPromise = null;

  /** @type {boolean} */
  searchResultCtrl.shouldShowConfirmation = false;
  /** @type {?number} */
  searchResultCtrl.countBeforePlayback = null;

  searchResultCtrl.appendResultToQueue = appendResultToQueue;

  /**
   * @param {mt.Video} video
   */
  function appendResultToQueue(video) {

    var queueEntry = queueManager.appendVideo(video);

    if (orchestrator.runningQueueEntry) {
      var entries = queueManager.queue.entries;
      searchResultCtrl.countBeforePlayback = entries.indexOf(queueEntry) - entries.indexOf(orchestrator.runningQueueEntry);
    } else {
      searchResultCtrl.countBeforePlayback = null;
    }

    queuesRegistry('queue').ready(function(queue) {
      queue.focusEntry(queueEntry);
    });

    searchResultCtrl.shouldShowConfirmation = true;
    $timeout.cancel(tmoPromise);
    tmoPromise = $timeout(function() {
      searchResultCtrl.shouldShowConfirmation = false;
    }, CONFIRMATION_DURATION);
  }
}

// @ngInject
function QueueCtrl(orchestrator, queueManager) {

  var queueCtrl = this;

  queueCtrl.playQueueEntry = playQueueEntry;
  queueCtrl.removeQueueEntry = removeQueueEntry;

  /**
   * @param {number} queueIndex
   */
  function playQueueEntry(queueIndex) {
    orchestrator.skipTo(queueIndex);
  }

  /**
   * @param {mt.QueueEntry} queueEntry
   */
  function removeQueueEntry(queueEntry) {
    queueManager.removeEntry(queueEntry);
  }
}

// @ngInject
function DebuggingCtrl(configuration, keyboardShortcutManager, notificationCentersRegistry, modalManager) {

  activate();

  function notifyError(message) {
    notificationCentersRegistry('notificationCenter').ready(function(notificationCenter) {
      notificationCenter.error(message);
    });
  }

  function notifyComingNext() {
    notificationCentersRegistry('notificationCenter').ready(function(notificationCenter) {
      notificationCenter.comingNext({
        current: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Fusce venenatis finibus pulvinar.',
        next: 'Pellentesque mollis eget velit ut eleifend. Nulla efficitur, mi non viverra semper, enim quam porttitor libero',
        imageUrl: 'https://i.ytimg.com/vi/69WltTXlmHs/mqdefault.jpg'
      });
    });
  }

  function activate() {
    if (configuration.debug) {
      // register the global space shortcut
      keyboardShortcutManager.register('ctrl+e', function(evt) {
        evt.preventDefault();
        notifyError('Debugging: Test notification');
      });

      keyboardShortcutManager.register('ctrl+c', function(evt) {
        evt.preventDefault();
        notifyComingNext();
      });

      keyboardShortcutManager.register('ctrl+m', function(evt) {
        evt.preventDefault();
        modalManager.open({
          title: 'This a a testing modal',
          contentTemplateUrl: 'noPlaybackModalContent',
          commands: [{label: 'OK', primary: true}]
        });
      });
    }
  }
}

exports.RootCtrl = RootCtrl;
exports.SearchResultsCtrl = SearchResultsCtrl;
exports.SearchResultCtrl = SearchResultCtrl;
exports.QueueCtrl = QueueCtrl;
exports.DebuggingCtrl = DebuggingCtrl;