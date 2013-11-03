(function (mt) {
    'use strict';

    mt.MixTubeApp.directive('mtCarousel', function ($rootScope, $window, $timeout) {

        var CAROUSEL_EXPRESSION_REGEXP = /^\s*(.+)\s+in\s+(.*?)\s*$/;
        var CSS_PREFIXES = ['-webkit-', ''];
        var EASE_IN_OUT_QUART = 'cubic-bezier(.77,0,.175,1)';

        /**
         * @param {string} expression
         * @returns {{valueIdentifier: string, listIdentifier: string}}
         */
        function parseRepeatExpression(expression) {
            var match = expression.match(CAROUSEL_EXPRESSION_REGEXP);
            if (!match) {
                throw new Error('Expected itemRepeat in form of "_item_ in _array_" but got "' + expression + '".');
            }
            return {
                valueIdentifier: match[1],
                listIdentifier: match[2]
            };
        }

        /**
         * @param {JQLite} target
         * @param {function()} callback
         * @returns {{disconnect: function()}}
         */
        function observeChildList(target, callback) {
            if (window.hasOwnProperty('MutationObserver')) {
                return new MutationObserver(function () {
                    $rootScope.$apply(function () {
                        callback();
                    });
                }).observe(target[0], { childList: true });
            } else {
                // only IE10 in the range of supported browsers
                // todo remove once IE11 has been released
                var subtreeModifiedHandler = function () {
                    // we need to let time for the node to be rendered before calling the callback
                    $timeout(function () {
                        callback();
                    }, 0);
                };
                target.bind('DOMNodeInserted DOMNodeRemoved', subtreeModifiedHandler);

                return {
                    disconnect: function () {
                        target.unbind('DOMNodeInserted', subtreeModifiedHandler);
                        target.unbind('DOMNodeRemoved', subtreeModifiedHandler);
                    }
                };
            }
        }

        return {
            restrict: 'E',
            replace: true,
            transclude: 'element',
            scope: true,
            template: function (tElement, tAttr) {
                return '<div class="mt-carousel-container">' +
                    '    <div class="mt-carousel-slider">' +
                    '        <div class="mt-carousel-list">' +
                    '            <div class="mt-carousel-bucket js-mt-carousel-item-bucket" ng-repeat="' + tAttr.bucketsRepeat + '" ' +
                    '                 mt-internal-bring-bucket-up-when="' + tAttr.bringBucketUpWhen + '" ' +
                    '                 ng-animate="' + tAttr.bucketsAnimate + '"></div>' +
                    '            <div class="mt-carousel-bucket js-mt-carousel-remainder-bucket"></div>' +
                    '        </div>' +
                    '    </div>' +
                    '</div>';
            },
            controller: function ($scope, $element) {

                var self = this;
                var carousel = $element;
                var slider = mt.tools.querySelector(carousel, '.mt-carousel-slider');
                var savedList = [];

                // allows to animate the slider
                CSS_PREFIXES.forEach(function (prefix) {
                    slider.css(prefix + 'transition', prefix + 'transform .5s ' + EASE_IN_OUT_QUART);
                });

                $scope.backwardAvailable = false;
                $scope.forwardAvailable = false;

                /**
                 * Pick the best carousel bucket available around the given x position.
                 *
                 * @param {number} x the position
                 * @returns {HTMLElement} the item at the position or undefined if none found
                 */
                function rawBucketFromPosition(x) {
                    return _.findWhere(mt.tools.querySelector(carousel, '.mt-carousel-bucket'), function (bucket) {
                        var bucketRect = bucket.getBoundingClientRect();
                        if (x > 0) {
                            // in forward we want the half visible bucket at the very right
                            // means the first bucket where the right edge position is higher that the looked for position
                            return x < bucketRect.right;
                        } else {
                            // in backward we want the fully visible bucket at 1 view port width distance from the left
                            // means the first bucket where the left edge position is higher that the looked for position
                            return x < bucketRect.left;
                        }
                    });
                }

                function page(forward) {
                    // works because the carousel is full width
                    var toBringUp = rawBucketFromPosition(carousel[0].getBoundingClientRect().width * (forward ? 1 : -1));
                    if (toBringUp) {
                        self.bringUp(angular.element(toBringUp));
                    }
                }

                function computeHandlesAvailability() {
                    var sliderRect = slider[0].getBoundingClientRect();
                    var carouselRect = carousel[0].getBoundingClientRect();

                    $scope.backwardAvailable = sliderRect.left < carouselRect.left;
                    $scope.forwardAvailable = carouselRect.right < sliderRect.right;
                }

                self.computeSizeRelated = function () {
                    computeHandlesAvailability();
                };

                self.bucketsUpdated = function (newList) {
                    if (angular.isArray(newList)) {
                        if (savedList.length < newList.length) {
                            // some buckets were added, we want to detect the index of the first one
                            // bellow the proper way to do it but because we now that we only add bucket at the end

                            var addedBucketIndex = -1;
                            for (var idx = 0; idx < savedList.length; idx++) {
                                if (savedList[idx] !== newList[idx]) {
                                    // found a different, save the index and break
                                    addedBucketIndex = idx;
                                    break;
                                }
                            }
                            if (addedBucketIndex === -1) {
                                // unsuccessful search means the new bucket is in the not yet explored part of the new list
                                addedBucketIndex = savedList.length;
                            }

                            // the bucket has been just added bring it up
                            self.bringUp(mt.tools.querySelector(carousel, '.mt-carousel-bucket').eq(addedBucketIndex));
                        }

                        // shallow copy the list for next change detection
                        savedList = newList.slice();
                    }
                };

                self.bringUp = function (toBringUp) {
                    var viewPortRect = carousel[0].getBoundingClientRect();
                    var toBringUpRect = toBringUp[0].getBoundingClientRect();

                    if (toBringUpRect.left < viewPortRect.left || viewPortRect.right < toBringUpRect.right) {
                        // the element to bring up is outside of the view port
                        // we want to make it the first visible item in the view port
                        var sliderRect = slider[0].getBoundingClientRect();
                        var newPosition = sliderRect.left - toBringUpRect.left;

                        CSS_PREFIXES.forEach(function (prefix) {
                            slider.css(prefix + 'transform', 'translateX(' + newPosition + 'px)');
                        });

                        // listen for end of transition to compute handles availability
                        slider.bind('transitionend', function transitionEndHandler() {
                            slider.unbind('transitionend', transitionEndHandler);
                            $scope.$apply(function () {
                                computeHandlesAvailability();
                            });
                        });
                    }
                };

                self.backward = function () {
                    page(false);
                };

                self.forward = function () {
                    page(true);
                };
            },
            compile: function (tElement, tAttr, originalLinker) {
                // we get the original directive outer HTML by executing the linker on a empty scope
                var tOriginal = originalLinker($rootScope.$new(true));
                var tHandles = tOriginal.find('handle');
                var tRenderer = tOriginal.find('renderer');
                var tRemainder = tOriginal.find('remainder');

                tElement.append(tHandles.contents());
                mt.tools.querySelector(tElement, '.js-mt-carousel-item-bucket').append(tRenderer.contents());
                mt.tools.querySelector(tElement, '.js-mt-carousel-remainder-bucket').append(tRemainder.contents());

                return function link(scope, element, attr, carouselCtrl) {
                    // react to items list changes
                    var identifiers = parseRepeatExpression(attr.bucketsRepeat);

                    scope.$watchCollection(identifiers.listIdentifier, function (newList) {
                        // works only with list of bucket
                        carouselCtrl.bucketsUpdated(newList);
                    });

                    // react to window resizing
                    var window = angular.element($window);
                    var resizeCarouselHandler = _.debounce(function () {
                        scope.$apply(function () {
                            carouselCtrl.computeSizeRelated();
                        });
                    }, 100);

                    window.bind('resize', resizeCarouselHandler);

                    // react to bucket insertion/removal
                    var bucketListObserver = observeChildList(mt.tools.querySelector(element, '.mt-carousel-list'), function () {
                        carouselCtrl.computeSizeRelated();
                    });

                    scope.$on('$destroy', function () {
                        window.unbind('resize', resizeCarouselHandler);
                        bucketListObserver.disconnect();
                    });

                    // methods that can be used by sub components
                    scope.backward = function () {
                        carouselCtrl.backward();
                    };
                    scope.forward = function () {
                        carouselCtrl.forward();
                    };
                }
            }
        };
    });

    mt.MixTubeApp.directive('mtInternalBringBucketUpWhen', function () {
        return {
            restrict: 'A',
            require: '^mtCarousel',
            link: function (scope, element, attrs, carouselCtrl) {
                scope.$watch(attrs.mtInternalBringBucketUpWhen, function watchBringUpIf(bringUp) {
                    if (bringUp) {
                        carouselCtrl.bringUp(element);
                    }
                });
            }
        };
    });
})(mt);