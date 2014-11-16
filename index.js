var express = require('express');
var vomit = require('./vomit');

var app = express();

app.set('views', __dirname + '/views');

app.engine('html', vomit.express);
app.set('view engine', 'html');

app.get('/', function (req, res) {
    res.render('index', {
        title: 'Vomit!',
        page: 'list.html',
        pageData: {
            list: ['1', '2', '3']
        }
    });
});

app.listen(3000);
