'use strict';

var isUndefined = require('lodash/lang/isUndefined');

// @ngInject
function searchCtrlHelperFactory($window, $document, $rootScope, $timeout, keyboardShortcutManager,
                                 searchInputsRegistry, youtubeClient) {

  var searchShown = false;
  var searchTerm = null;

  // copied from https://css-tricks.com/making-sass-talk-to-javascript-with-json/
  var REGEXP_CSS_CONTENT_QUOTES = /^['"]+|\s+|\\|(;\s?})+|['"]$/g;

  /**
   * @const
   * @type {number}
   */
  var INSTANT_SEARCH_DELAY = 500;

  /** @type {number} */
  var searchRequestCount = 0;
  /** @type {?Promise} */
  var instantSearchPromise = null;


  // this object will be exposed in order to display results. Its properties will be initialized by the initSearch function.
  var searchResultsData = {

    /**
     * The user already executed one search. Used to hide the results pane until there is something to show.
     *
     * @type {boolean}
     */
    inSearch: null,
    /**
     * A list of results pages.
     *
     * @type {Object.<string, Array.<Array.<Video>>>}
     */
    results: null,
    /** @type {Object.<string, boolean>} */
    pending: null,
    /** @type {Object.<string, boolean>} */
    pendingMore: null,
    /** @type {Object.<string, boolean>} */
    error: null,
    /** @type {Object.<string, boolean>} */
    noneFound: null,
    /** @type {Object.<string, string>} */
    nextPageId: null
  };

  function shouldShowSearchResultPanel() {
    return searchShown && searchResultsData.inSearch;
  }

  function initSearch() {
    instantSearchPromise = null;
    searchResultsData.inSearch = false;
    searchResultsData.results = {youtube: [[]]};
    searchResultsData.pending = {youtube: false};
    searchResultsData.pendingMore = {youtube: false};
    searchResultsData.nextPageId = {youtube: null};
    searchResultsData.error = {youtube: false};
    searchResultsData.noneFound = {youtube: false};
  }

  function showMore(pId, nextPageId) {
    if (pId === 'youtube') {
      // clear any error message (case of retry after error)
      searchResultsData.error.youtube = false;
      searchYoutube(searchCtrlHelper.searchTerm, nextPageId);
    }
  }

  /**
   * @param {string} term
   * @param {string=} nextPageId
   * @returns {Promise}
   */
  function searchYoutube(term, nextPageId) {
    var first = !nextPageId;

    var pageSize,
      startSearchRequestCount = searchRequestCount,
      resultsLayoutInfo = searchCtrlHelper.resultsLayoutInfo;

    if (first) {
      pageSize = Math.max(11, resultsLayoutInfo.promotedCount + resultsLayoutInfo.regularCount * 3);

      searchResultsData.pending.youtube = true;

      // reset the results list and the next page token since we are starting a new search
      searchResultsData.results.youtube = [];
      searchResultsData.nextPageId.youtube = null;
    } else {
      pageSize = Math.max(12, resultsLayoutInfo.regularCount * 4);

      searchResultsData.pendingMore.youtube = true;
    }

    // safety check on requested page size
    var boundedPageSize = Math.min(pageSize, youtubeClient.maxResultsLimit);

    return youtubeClient.searchVideosByQuery(
      term,
      {
        pageSize: boundedPageSize,
        pageId: nextPageId
      },
      function progressCb(results) {
        if (searchRequestCount === startSearchRequestCount) {
          if (results.videos.length) {
            searchResultsData.results.youtube.push(results.videos);
            searchResultsData.nextPageId.youtube = results.nextPageId;
          } else {
            searchResultsData.noneFound.youtube = true;
          }
        }
      })
      .then(function doneCb() {
        if (searchRequestCount === startSearchRequestCount) {
          if (first) {
            searchResultsData.pending.youtube = false;
          } else {
            searchResultsData.pendingMore.youtube = false;
          }
        }
      })
      .catch(function catchCb() {
        if (searchRequestCount === startSearchRequestCount) {
          searchResultsData.error.youtube = true;
          if (first) {
            searchResultsData.pending.youtube = false;
            searchResultsData.results.youtube = [];
          } else {
            searchResultsData.pendingMore.youtube = false;
          }
        }
      });
  }

  function activate() {
    initSearch();

    // when the user types we automatically execute the search
    $rootScope.$watch(function() {
      return searchCtrlHelper.searchTerm;
    }, function(newSearchTerm) {
      if (newSearchTerm !== null) {

        // new inputs so we stop the previous request
        $timeout.cancel(instantSearchPromise);

        // as soon as the query changes clear messages
        searchResultsData.error.youtube = false;
        searchResultsData.noneFound.youtube = false;

        // if the search has to be longer than two characters
        if (newSearchTerm.length > 2) {
          searchRequestCount++;

          $timeout.cancel(instantSearchPromise);
          instantSearchPromise = $timeout(function search() {
            searchResultsData.inSearch = true;

            // we need to delay the actual search in order for the search panel show animation to work
            $timeout(function() {
              searchYoutube(newSearchTerm);
            }, 0);
          }, INSTANT_SEARCH_DELAY);
        }
      }
    });

    // ensures everything is initialized when the search is shown and stopped when it is hidden
    $rootScope.$watch(function() {
      return searchCtrlHelper.searchShown;
    }, function(searchShown) {
      if (searchShown) {
        initSearch();
      } else {
        $timeout.cancel(instantSearchPromise);
      }
    });
  }

  /**
   * @param {boolean=} showOrHide if not given it will toggle the visibility
   */
  function toggleSearch(showOrHide) {
    searchShown = isUndefined(showOrHide) ? !searchShown : showOrHide;

    if (searchShown) {
      // reset search term before showing the search input
      searchTerm = null;
      keyboardShortcutManager.enterScope('search');
    } else {
      keyboardShortcutManager.leaveScope('search');
    }

    searchInputsRegistry('search').ready(function(searchInput) {
      searchInput.toggle(searchShown);
    });
  }

  activate();

  /**
   * @name searchCtrlHelper
   */
  var searchCtrlHelper = {

    get searchShown() {
      return searchShown;
    },

    get searchTerm() {
      return searchTerm;
    },

    set searchTerm(value) {
      searchTerm = value;
    },

    get resultsLayoutInfo() {
      var contentValue = $window.getComputedStyle(
        $document[0].querySelector('.mt-js-results'), ':before').getPropertyValue('content');

      return JSON.parse(contentValue.replace(REGEXP_CSS_CONTENT_QUOTES, ''));
    },

    get searchResultsData() {
      return searchResultsData;
    },

    toggleSearch: toggleSearch,
    shouldShowSearchResultPanel: shouldShowSearchResultPanel,
    showMore: showMore
  };

  return searchCtrlHelper;
}

module.exports = searchCtrlHelperFactory;

