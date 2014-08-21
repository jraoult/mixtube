(function (mt) {
    'use strict';

    mt.MixTubeApp.factory('mtSlideSizeAnimationBuilder', function (animationsConfig) {

        var BASE_VELOCITY_ANIM_CONF = {
            duration: animationsConfig.transitionDuration,
            easing: animationsConfig.easeInOutBezierPoints
        };

        /**
         * Creates the config used by enter and leave method
         *
         * @param {JQLite} element
         * @returns {{ltr: boolean}} true if the slide move should be from left to right, false else
         */
        function buildConfig(element) {
            return {
                ltr: !element.hasClass('from-right')
            };
        }

        function builder() {
            return {

                enter: function (element, done) {

                    var config = buildConfig(element);
                    var txBeginning = config.ltr ? '-100%' : '100%';
                    var nominalHeight = element[0].getBoundingClientRect().height;

                    element
                        .css({height: 0, transform: 'translateX(' + txBeginning + ')'})

                        .velocity({height: [nominalHeight, 0]}, _.defaults(
                            {
                                // disable mobile optimisation because VelocityJS uses the null transform hack
                                // which would override our translate value
                                mobileHA: false
                            },
                            BASE_VELOCITY_ANIM_CONF))

                        .velocity({translateX: [0, txBeginning]}, _.defaults(
                            {
                                complete: function () {
                                    element.css({height: '', transform: ''});
                                    done();
                                }
                            }, BASE_VELOCITY_ANIM_CONF));
                },

                leave: function (element, done) {

                    var config = buildConfig(element);
                    var nominalHeight = element[0].getBoundingClientRect().height;

                    element
                        .velocity({translateX: [config.ltr ? '-100%' : '100%', 0]}, BASE_VELOCITY_ANIM_CONF)
                        .velocity({height: [0, nominalHeight]}, _.defaults({complete: done}, BASE_VELOCITY_ANIM_CONF));
                },

                move: function (element, done) {
                    // move doesn't really make sense for the use cases sor far
                    done();
                }
            };
        }

        builder.buildConfig = buildConfig;
        builder.BASE_VELOCITY_ANIM_CONF = BASE_VELOCITY_ANIM_CONF;
        return builder;
    });
})(mt);