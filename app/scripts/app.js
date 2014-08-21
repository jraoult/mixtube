(function (mt) {
    'use strict';

    var $document = angular.element(document);
    $document.ready(function () {
        angular.bootstrap(document, ['mtMixTubeApp']);
    });

    /**
     * Default configuration for animations. These values are shared with the SASS counterpart.
     *
     * @name animationsConfig
     */
    var animationsConfig = {
        // SASS $baseTransitionDuration
        get transitionDuration() {
            return 200;
        },
        // SASS $easeInOut
        get easeInOutBezierPoints() {
            return [.8, 0, .2, 1];
        }
    };

    mt.MixTubeApp = angular.module('mtMixTubeApp', ['ngAnimate'])
        .config(function ($locationProvider) {
            $locationProvider.html5Mode(true);
        })

        .constant('animationsConfig', animationsConfig)

        .run(function ($rootScope, $controller, Configuration) {
            // make sure the scope always has the props property
            $rootScope.props = {};

            if (Configuration.debug) {
                $controller('mtDebuggingCtrl');
            }
        });

})(window.mt = window.mt || {});