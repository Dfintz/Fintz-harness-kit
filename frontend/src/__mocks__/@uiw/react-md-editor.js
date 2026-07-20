const React = require('react');

function MockMDEditor(props) {
  const { value = '', onChange, ...rest } = props || {};

  return React.createElement('textarea', {
    'data-testid': 'mock-md-editor',
    value,
    onChange: event => {
      if (typeof onChange === 'function') {
        onChange(event.target.value);
      }
    },
    ...rest,
  });
}

MockMDEditor.Markdown = function MockMarkdown(props) {
  const source = props && typeof props.source === 'string' ? props.source : '';
  return React.createElement('div', { 'data-testid': 'mock-md-markdown' }, source);
};

module.exports = MockMDEditor;
module.exports.default = MockMDEditor;
