'use strict';

function directivesRegistryHelperFactory() {

  /**
   * @name DirectivesRegistryHelper
   */
  var DirectivesRegistryHelper = {
    install: function(facade, registry, attributeName, directiveScope, directiveAttrs) {
      var name = directiveAttrs[attributeName];
      if (!name || name.trim().length === 0) {
        throw new Error(attributeName + ' expected a non empty string as value');
      }
      registry.register(name, facade);
      directiveScope.$on('$destroy', function() {
        registry.unregister(name);
      });
    }
  };

  return DirectivesRegistryHelper;
}

module.exports = directivesRegistryHelperFactory;