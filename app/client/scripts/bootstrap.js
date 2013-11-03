(function (mt) {
    'use strict';

    mt.MixTubeClientApp = angular.module('mtMixTubeClientApp', ['mtMixTubeCommon'])
        .config(function ($locationProvider) {
            $locationProvider.html5Mode(true);
        });

})(window.mt = window.mt || {});
