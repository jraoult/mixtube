(function (mt) {
    'use strict';

    // add an event property "redundantClick" to tell that if the click was done quickly after the first one
    // useful to filter out inadvertent in some scenario.
    mt.MixTubeCommon.directive('ngClick', function () {
        return {
            restrict: 'A',
            priority: 10, // priority at 10 to be executed before the original angular click directive
            link: function (scope, element) {
                element.bind('click', function (evt) {
                    var now = Date.now();
                    var lastClickTs = element.data('mtLastClickTS');
                    if (lastClickTs && now - lastClickTs < 500) {
                        evt.redundantClick = true;
                    }
                    element.data('mtLastClickTS', now);
                });
            }
        };
    });

    // simple event listener directives for focus and blur events type
    ['blur', 'focus'].forEach(function (evtName) {
        var directiveName = 'mt' + mt.tools.capitalize(evtName);
        mt.MixTubeCommon.directive(directiveName, function ($parse) {
            return function (scope, elmt, attr) {
                var fn = $parse(attr[directiveName]);
                elmt.bind(evtName, function (event) {
                    scope.$apply(function () {
                        fn(scope, {$event: event});
                    });
                });
            };
        });
    });

    // intercept rendering initiated by ngModel directive in order to focus the element on model change
    // it is useful to enforce good sequencing of focus then value affectation to get a proper caret position (FF and IE)
    mt.MixTubeCommon.directive('mtFocusOnRender', function ($timeout) {
        return {
            restrict: 'A',
            require: 'ngModel',
            link: function (scope, element, attr, ngModelCtrl) {
                var saved$render = ngModelCtrl.$render;
                ngModelCtrl.$render = function () {
                    // we need the input to be visible before set the value (and by focusing it thanks to model change)
                    // the only way from now is to protectively defer the affectation thanks to timeout
                    // for details see https://github.com/angular/angular.js/issues/1250#issuecomment-8604033
                    $timeout(function () {
                        element[0].focus();
                        saved$render();
                        if (attr.hasOwnProperty('autoSelect')) {
                            element[0].select();
                        }
                    }, 0);
                };
            }
        };
    });

    // mouse start and stop directive which are mouse move listener with debouncing for respectively leading and
    // trailing edge of the wait period defined by the related attribute "debounce"
    [
        {name: 'start', debounceParams: {leading: true, trailing: false}},
        {name: 'stop', debounceParams: {leading: false, trailing: true}}
    ].forEach(function (descriptor) {
            var directiveName = 'mtMouse' + descriptor.name;

            mt.MixTubeCommon.directive(directiveName, function ($parse) {
                return function (scope, elmt, attr) {

                    var fn = $parse(attr[directiveName]);

                    // get the debounce wait value (default value if unspecified is 500ms)
                    var waitTime = parseInt(attr.debounce, 10) || 500;

                    elmt.bind('mousemove', _.debounce(function (evt) {
                        scope.$apply(function () {
                            fn(scope, {$event: evt});
                        });
                    }, waitTime, descriptor.debounceParams));
                };
            });
        });

    mt.MixTubeCommon.directive('mtScrollTopOnChange', function () {
        return function (scope, element, attr) {

            var currentTween = null;

            scope.$watch(attr.mtScrollTopOnChange, function mtScrollTopOnChangeAction() {
                if (!currentTween) {
                    currentTween = mt.tools.tween({
                        useRAF: true,
                        target: function (values) {
                            element[0].scrollTop = values.scrollTop;
                        },
                        from: {
                            scrollTop: element[0].scrollTop
                        },
                        to: {
                            scrollTop: 0
                        },
                        duration: 300,
                        complete: function () {
                            currentTween = null;
                        }
                    }).play();
                }
            });
        };
    });

    mt.MixTubeCommon.directive('mtInlineEdit', function ($templateCache, $compile, $parse, mtKeyboardShortcutManager) {
        return {
            restrict: 'A',
            link: function (scope, element, attr) {
                var inputFacetLinker = $compile($templateCache.get('mtInlineEditTemplate').trim());

                var mtInlineEditGet = $parse(attr.mtInlineEdit);
                var mtInlineEditSet = mtInlineEditGet.assign;

                // the insulated scope allows to choose when we want to send the updates to the parent model
                // we can't use a directive wide insulated scope because the display element may need some properties
                // from the parent scope to render
                var inputScope = scope.$new(true);
                inputScope.edition = false;
                inputScope.model = null;
                inputScope.blur = function () {
                    rollback();
                };

                function save() {
                    inputScope.edition = false;
                    mtInlineEditSet(scope, inputScope.model);
                    inputScope.model = null;
                }

                function rollback() {
                    inputScope.edition = false;
                    inputScope.model = null;
                }

                inputFacetLinker(inputScope, function (inputFacet) {
                    // register keyboard shortcut context for the input element
                    var keyboardShortcutContext = 'mtInlineEdit_' + inputScope.$id;
                    mtKeyboardShortcutManager.register(keyboardShortcutContext, 'return', function () {
                        save();
                    });
                    mtKeyboardShortcutManager.register(keyboardShortcutContext, 'esc', function () {
                        rollback();
                    });

                    // place the input just after de display element
                    element.after(inputFacet);

                    inputScope.$watch('edition', function (newEdition, oldEdition) {
                        if (newEdition !== oldEdition) {
                            if (newEdition) {
                                element.css('display', 'none');
                                mtKeyboardShortcutManager.enterContext(keyboardShortcutContext);
                            } else {
                                mtKeyboardShortcutManager.leaveContext(keyboardShortcutContext);
                                element.css('display', '');
                            }
                        }
                    });

                    element.bind('click', function () {
                        inputScope.$apply(function () {
                            inputScope.edition = true;
                            inputScope.model = mtInlineEditGet(scope);
                        });
                    });
                });
            }
        };
    });

    // a duration formatter that takes a duration in milliseconds and returns a formatted duration like "h:mm"
    mt.MixTubeCommon.filter('mtDuration', function () {
        // reuse the date object between invocation since it is only used as a formatting tool
        var singletonDate = new Date(0, 0, 0, 0, 0, 0, 0);
        // time that represent the absolute zero for date, all fields to zero
        // needs to be computed because of timezones differences
        var absoluteDateZero = singletonDate.getTime();

        return function (time) {
            if (isNaN(time)) {
                return '';
            }

            // reset the time to the zero to calculate durations
            singletonDate.setTime(absoluteDateZero);
            singletonDate.setMilliseconds(time);

            return (singletonDate.getHours() * 60 + singletonDate.getMinutes()).toString(10) + ':' + mt.tools.leftPad(singletonDate.getSeconds().toString(10), 2, '0');
        }
    });
})(mt);