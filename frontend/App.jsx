import React from 'react';
import ReactDOM from 'react-dom';

import Main from "./app/Main.jsx"

import * as FastClick from 'fastclick'
if ('addEventListener' in document) {
    document.addEventListener('DOMContentLoaded', function() {
        FastClick.attach(document.body);
    }, false);
}

ReactDOM.render(<Main />,
    document.getElementById('root'),
);