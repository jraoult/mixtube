(function (mt) {
    'use strict';

    /**
     * @ngdoc directive
     * @name mt.directive:mtScrollable
     * @restrict A
     *
     * Declares a scrollable container that can be manipulated thanks to its controller.
     *
     * An anchor string declared on children elements thanks to the "mt-scrollable-anchor" attribute can be then used
     * when calling {@link mtScrollable.mtScrollableController#putAnchorInViewPort(string)} to scroll until the child element
     * is visible.
     */
    mt.MixTubeApp.directive('mtScrollable', function (BASE_TRANSITION_DURATION, EASE_IN_OUT_BEZIER_POINTS) {

        /**
         * @param {JQLite} container
         * @param {JQLite} content
         * @returns {boolean} true if the content is fully contained in the container along the Y axis
         */
        function containsY(container, content) {
            var containerRect = container[0].getBoundingClientRect();
            var contentRect = content[0].getBoundingClientRect();
            return containerRect.top < contentRect.top && contentRect.bottom < containerRect.bottom;
        }

        return {
            restrict: 'A',
            controller: function ($scope, $element) {

                var scrollable = $element;

                this.putAnchorInViewPort = function (anchor, done) {
                    var target = mt.commons.querySelector(scrollable, '[mt-anchor="' + anchor + '"]');
                    if (target.length > 0 && !containsY(scrollable, target)) {
                        target.velocity(
                            'scroll',
                            {
                                container: scrollable,
                                duration: BASE_TRANSITION_DURATION,
                                easing: EASE_IN_OUT_BEZIER_POINTS,
                                complete: done
                            }
                        );
                    }
                };
            }
        };
    });
})(mt);