(function (mt) {
    'use strict';

    mt.MixTubeCommon.factory('mtModal', function ($rootScope, $q, $templateCache, $compile, $document, mtKeyboardShortcutManager) {

        /**
         * @const
         * @type {JQLite}
         */
        var BODY = $document.find('body');

        /**
         * @type {boolean}
         */
        var modalOpened = false;

        return {

            /**
             * Opens a modal with the given scope applied to the given template url.
             *
             * The given scope is augmented with two callback method: "mtClose" and "mtDismiss" that can be called from
             * the template.
             *
             * @param {{templateUrl: string, scope: Object}} config
             * @returns {promise} resolved / rejected when called the method "mtClose" / "mtDismiss"
             */
            open: function (config) {
                if (modalOpened) {
                    throw new Error('Can not open a new modal, there is already one active.');
                }

                modalOpened = true;

                var modalDeferred = $q.defer();
                var modalElement = $compile($templateCache.get('mtModalTemplate').trim())(config.scope);

                function close(resolve) {
                    modalElement.remove();
                    modalElement = null;
                    mtKeyboardShortcutManager.leaveContext('modal');
                    mtKeyboardShortcutManager.clear('modal');
                    modalOpened = false;

                    resolve ? modalDeferred.resolve() : modalDeferred.reject();
                }

                // augment the scope
                config.scope.mtContentTemplateUrl = config.templateUrl;
                config.scope.mtClose = function () {
                    close(true);
                };
                config.scope.mtDismiss = function () {
                    close(false);
                };

                // pressing escape key will close the current modal
                mtKeyboardShortcutManager.register('modal', 'esc', function () {
                    close(false);
                });
                mtKeyboardShortcutManager.enterContext('modal');

                BODY.prepend(modalElement);

                return modalDeferred.promise;
            },

            /**
             * Opens a confirmation dialog with the given message.
             *
             * @param {string} message the message to display. Can not contains HTML.
             * @returns {promise} resolved when the user confirms, rejected when the user cancels
             */
            confirm: function (message) {
                var scope = $rootScope.$new(true);
                scope.message = message;
                return this.open({templateUrl: 'mtConfirmTemplate', scope: scope});
            }
        }
    });
})(mt);