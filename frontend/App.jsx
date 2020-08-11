import React from 'react';
import ReactDOM from 'react-dom';

import * as FastClick from 'fastclick'
if ('addEventListener' in document) {
    document.addEventListener('DOMContentLoaded', function() {
        FastClick.attach(document.body);
    }, false);
}

ReactDOM.render(<div>
    BRUH
</div>,
    document.getElementById('root'),
);