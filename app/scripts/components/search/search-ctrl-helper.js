(function() {
  'use strict';

  function SearchCtrlHelperFactory(KeyboardShortcutManager, SearchInputsRegistry) {

    var searchShown = false;
    var searchTerm = null;

    /**
     * @param {boolean=} showOrHide if not given it will toggle the visibility
     */
    function toggleSearch(showOrHide) {
      searchShown = _.isUndefined(showOrHide) ? !searchShown : showOrHide;

      if (searchShown) {
        // reset search term before showing the search input
        searchTerm = null;
        KeyboardShortcutManager.enterScope('search');
      } else {
        KeyboardShortcutManager.leaveScope('search');
      }

      SearchInputsRegistry('search').ready(function(searchInput) {
        searchInput.toggle(searchShown);
      });
    }

    /**
     * @name SearchCtrlHelper
     */
    var SearchCtrlHelper = {

      get searchShown() {
        return searchShown;
      },

      get searchTerm() {
        return searchTerm;
      },

      set searchTerm(value) {
        searchTerm = value;
      },

      toggleSearch: toggleSearch
    };

    return SearchCtrlHelper;
  }

  angular.module('Mixtube').factory('SearchCtrlHelper', SearchCtrlHelperFactory);

})();