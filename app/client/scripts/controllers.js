(function (mt) {
    'use strict';

    mt.MixTubeClientApp.controller('mtClientConnectionCtrl', function ($location, mtSharedQueueClientManager) {

        var ctrl = this;

        ctrl.sharedQueueId = $location.search().hasOwnProperty('sqi') ? $location.search().sqi : null;
        ctrl.clientName = null;
        ctrl.joining = false;
        ctrl.joined = false;

        ctrl.join = function () {
            ctrl.joining = true;
            ctrl.joined = false;
            ctrl.error = false;

            mtSharedQueueClientManager
                .joinSharedQueue(ctrl.sharedQueueId)
                .then(
                function () {
                    mtSharedQueueClientManager.sayHello(ctrl.clientName);
                    ctrl.joined = true;
                },
                function () {
                    ctrl.error = true;
                })
                .always(function () {
                    ctrl.joining = false;
                });
        };

    });

    mt.MixTubeClientApp.controller('mtClientSearchCtrl', function (mtYoutubeClient, mtSharedQueueClientManager) {

        var ctrl = this;

        ctrl.searchTerm = null;
        ctrl.searchResults = [];
        ctrl.searchPending = false;

        ctrl.search = function () {
            ctrl.searchPending = true;

            mtYoutubeClient.searchVideosByQuery(ctrl.searchTerm, function (videos) {
                ctrl.searchResults = videos;
                ctrl.searchPending = false;
            });
        };

        ctrl.appendToQueue = function (searchResult) {
            mtSharedQueueClientManager.appendVideo(searchResult.id);
        };
    });

})(mt);